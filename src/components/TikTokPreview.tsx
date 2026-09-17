import { useEffect, useRef, useState } from "react";

const TIKTOK_PLAYER_ORIGIN = "https://www.tiktok.com";
/** Tamanho nativo do embed player oficial do TikTok — ele não desenha bem
 * a própria interface abaixo disso, então renderiza nesse tamanho e
 * encolhe visualmente com `transform: scale()`. */
const PLAYER_NATIVE_WIDTH = 325;
const PLAYER_NATIVE_HEIGHT = 578;
/** Intervalo do loop aproximado — o embed player documenta os comandos de
 * saída (play/pause/seekTo) via postMessage, mas não garante um evento de
 * currentTime confiável de volta, então isso é aproximação por timer, não
 * leitura real do tempo do player. */
const LOOP_INTERVAL_MS = 3000;

function extractTikTokId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Capa estática do vídeo — é assim que catálogos de loja mostram a imagem
 * "já ali" sem esperar o player: o endpoint oEmbed público do TikTok
 * (CORS liberado pra qualquer site, sem chave) devolve `thumbnail_url`, uma
 * URL assinada da CDN deles que expira em algumas horas/dias. Por isso não
 * dá pra "gravar" essa imagem de vez no build — teria que baixar e hospedar
 * a capa por conta própria, e o dataset de origem evita isso de propósito
 * (ver NOTICE.md do repo: não redistribuir capa/imagem do vídeo). Em vez
 * disso, busca ao vivo (cache em memória por aba, TTL curto) e troca pro
 * player só quando o card fica visível — a imagem cobre o tempo até lá.
 */
const thumbnailCache = new Map<string, { url: string | null; expiresAt: number }>();
const THUMBNAIL_CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchThumbnailUrl(videoUrl: string): Promise<string | null> {
  const cached = thumbnailCache.get(videoUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { thumbnail_url?: unknown };
    const url = typeof data.thumbnail_url === "string" && data.thumbnail_url.startsWith("https://") ? data.thumbnail_url : null;
    thumbnailCache.set(videoUrl, { url, expiresAt: Date.now() + THUMBNAIL_CACHE_TTL_MS });
    return url;
  } catch {
    return null;
  }
}

function postToPlayer(iframe: HTMLIFrameElement, type: string, value?: number) {
  try {
    const msg: Record<string, unknown> = { "x-tiktok-player": true, type };
    if (value !== undefined) msg.value = value;
    iframe.contentWindow?.postMessage(msg, TIKTOK_PLAYER_ORIGIN);
  } catch {
    // noop
  }
}

interface TikTokPreviewProps {
  videoUrl: string;
  /** Tamanho visível desejado — o iframe nativo (325x578) é escalado pra caber aqui. */
  width?: number;
  height?: number;
}

export function TikTokPreview({ videoUrl, width = 140, height = 249 }: TikTokPreviewProps) {
  const videoId = extractTikTokId(videoUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Fica parado mostrando a capa até o card atingir uma boa parte da tela
  // (60%) — só aí monta o player e começa o loop. Sair desse nível
  // desmonta o player e volta pra capa parada.
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6],
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Busca a capa assim que o card monta (não espera ficar visível) — é o
  // que dá a sensação de "já aparecendo a imagem" no catálogo, mesmo antes
  // de rolar até ele.
  useEffect(() => {
    let cancelled = false;
    fetchThumbnailUrl(videoUrl).then((url) => {
      if (!cancelled) setThumbnailUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!videoId) return;
    const el = containerRef.current;
    if (!el) return;

    if (visible && !iframeRef.current) {
      const iframe = document.createElement("iframe");
      iframe.src = `${TIKTOK_PLAYER_ORIGIN}/player/v1/${videoId}?autoplay=1&muted=1&loop=1&controls=0`;
      iframe.allow = "autoplay";
      // pointer-events:none trava clique no player — sem isso, tocar no
      // vídeo abre o TikTok de verdade (é conteúdo deles dentro do
      // iframe, a gente não controla o que acontece num clique lá
      // dentro). Aqui é só prévia passiva; a única saída pro TikTok é o
      // link "Ver no TikTok" explícito, abaixo do card.
      iframe.style.cssText = `position:absolute;top:0;left:0;width:${PLAYER_NATIVE_WIDTH}px;height:${PLAYER_NATIVE_HEIGHT}px;border:0;transform-origin:top left;transform:scale(${width / PLAYER_NATIVE_WIDTH});pointer-events:none;`;
      iframe.addEventListener("load", () => setLoaded(true));
      el.appendChild(iframe);
      iframeRef.current = iframe;

      loopTimerRef.current = setInterval(() => {
        postToPlayer(iframe, "pause");
        postToPlayer(iframe, "seekTo", 0);
        postToPlayer(iframe, "play");
      }, LOOP_INTERVAL_MS);
    }

    if (!visible && iframeRef.current) {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
      iframeRef.current.remove();
      iframeRef.current = null;
      setLoaded(false);
    }

    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, [visible, videoId, width]);

  if (!videoId) {
    return (
      <div
        style={{
          width,
          height,
          borderRadius: 8,
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B6B6B",
          fontSize: 11,
          textAlign: "center",
          padding: 6,
        }}
      >
        Prévia não disponível
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          overflow: "hidden",
          width,
          height,
          borderRadius: 8,
          background: "#111",
          backgroundImage: thumbnailUrl ? `url("${thumbnailUrl}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!loaded && !thumbnailUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B6B6B",
              fontSize: 11,
            }}
          >
            carregando…
          </div>
        )}
      </div>
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 11, color: "#8A8A8A", textAlign: "center" }}
      >
        Ver no TikTok ↗
      </a>
    </div>
  );
}
