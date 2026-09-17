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

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!videoId) return;
    const el = containerRef.current;
    if (!el) return;

    if (visible && !iframeRef.current) {
      const iframe = document.createElement("iframe");
      iframe.src = `${TIKTOK_PLAYER_ORIGIN}/player/v1/${videoId}?autoplay=1&muted=1&loop=1&controls=0`;
      iframe.allow = "autoplay";
      iframe.style.cssText = `position:absolute;top:0;left:0;width:${PLAYER_NATIVE_WIDTH}px;height:${PLAYER_NATIVE_HEIGHT}px;border:0;transform-origin:top left;transform:scale(${width / PLAYER_NATIVE_WIDTH});`;
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
        style={{ position: "relative", overflow: "hidden", width, height, borderRadius: 8, background: "#111" }}
      >
        {!loaded && (
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
