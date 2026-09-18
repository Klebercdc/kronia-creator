import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMovementCategoriesFn,
  listMovementsByCategoryFn,
  composeMovementPromptFn,
  type MovementCategory,
  type MovementEntry,
} from "../server/movement-library.functions";

/** Clipe stock do Pexels é o vídeo inteiro (pode passar de 10-30s) — corta
 * em loop de 3s a partir do início em vez de carregar/tocar tudo, tanto
 * pra dar o efeito de "preview curto" quanto pra pesar menos (não faz
 * sentido baixar um clipe de 15MB inteiro pra mostrar só o começo). */
const PREVIEW_LOOP_SEC = 3;

function MovementPreview({ entry, selected }: { entry: MovementEntry; selected: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (v && v.currentTime >= PREVIEW_LOOP_SEC) {
      v.currentTime = 0;
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "9 / 14",
        borderRadius: 10,
        overflow: "hidden",
        background: "#111",
        border: selected ? "2px solid #FF8A1A" : "1px solid #232323",
      }}
    >
      {entry.videoUrl ? (
        <video
          ref={videoRef}
          src={entry.videoUrl}
          autoPlay
          muted
          playsInline
          onTimeUpdate={handleTimeUpdate}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            color: "#4A4A4A",
            fontSize: 10,
            textAlign: "center",
            padding: 6,
          }}
        >
          <span style={{ fontSize: 20 }}>🎬</span>
          <span>prévia em breve</span>
        </div>
      )}
      {entry.durationSec != null && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
            fontSize: 10,
            padding: "1px 5px",
            borderRadius: 6,
            fontFamily: "monospace",
          }}
        >
          {entry.durationSec}s
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 5,
          left: 5,
          width: 18,
          height: 18,
          borderRadius: 5,
          border: selected ? "none" : "1.5px solid rgba(255,255,255,0.6)",
          background: selected ? "linear-gradient(135deg, #FF8A1A, #FF5500)" : "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {selected ? "✓" : ""}
      </div>
    </div>
  );
}

export function MovementLibraryCatalog() {
  const listCategoriesRpc = useServerFn(listMovementCategoriesFn);
  const listMovementsRpc = useServerFn(listMovementsByCategoryFn);
  const composeRpc = useServerFn(composeMovementPromptFn);

  const [categories, setCategories] = useState<MovementCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [movements, setMovements] = useState<MovementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  // Ordem de clique preservada — é a ordem que vira a sequência da cena final.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composed, setComposed] = useState<{ text: string; totalDurationSec: number } | null>(null);
  const [composing, setComposing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listCategoriesRpc().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategorySlug(cats[0].slug);
    });
  }, []);

  useEffect(() => {
    if (!categorySlug) return;
    setLoading(true);
    listMovementsRpc({ data: { categorySlug } })
      .then(setMovements)
      .finally(() => setLoading(false));
  }, [categorySlug]);

  const selectedMap = useMemo(() => new Map(movements.map((m) => [m.id, m])), [movements]);

  function toggle(id: string) {
    setComposed(null);
    setCopied(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearSelection() {
    setSelectedIds([]);
    setComposed(null);
    setCopied(false);
  }

  async function handleGenerate() {
    setComposing(true);
    setCopied(false);
    try {
      const res = await composeRpc({ data: { ids: selectedIds } });
      setComposed(res);
    } finally {
      setComposing(false);
    }
  }

  async function handleCopy() {
    if (!composed) return;
    try {
      await navigator.clipboard.writeText(composed.text);
      setCopied(true);
    } catch {
      // clipboard indisponível (ex: contexto não-seguro) — o texto já está
      // visível na caixa abaixo pra copiar manualmente.
    }
  }

  const totalSelectedDuration = selectedIds.reduce((sum, id) => sum + (selectedMap.get(id)?.durationSec ?? 0), 0);

  return (
    <div>
      <div className="hint" style={{ marginBottom: 10 }}>
        Escolha a categoria da roupa, marque os movimentos que quer no vídeo (na ordem que devem acontecer) e gere o
        prompt final pra colar no Flow.
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`pill ${categorySlug === c.slug ? "active" : ""}`}
            onClick={() => setCategorySlug(c.slug)}
            style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
          >
            {c.label}
            {c.engine === "veo3" ? " · Veo3" : ""} ({c.count})
          </button>
        ))}
      </div>

      {loading && <div className="hint">Carregando…</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: selectedIds.length > 0 ? 140 : 16,
        }}
      >
        {movements.map((m) => {
          const selected = selectedIds.includes(m.id);
          const order = selected ? selectedIds.indexOf(m.id) + 1 : null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "none",
                border: "none",
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <MovementPreview entry={m} selected={selected} />
              {order && (
                <div
                  style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#FF5500",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {order}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#C9C9C9", lineHeight: 1.25 }}>{m.title}</div>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div
          style={{
            position: "sticky",
            // .app reserva 88px de padding-bottom pra caber a bottom-nav fixa
            // (ver .app/.bottom-nav em styles.css) — sem esse offset o painel
            // gruda embaixo da tela mas fica escondido atrás da nav.
            bottom: "calc(88px + env(safe-area-inset-bottom))",
            background: "#0D0D0D",
            border: "1px solid #232323",
            borderRadius: 14,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#8A8A8A" }}>
            <span>
              {selectedIds.length} movimento{selectedIds.length > 1 ? "s" : ""} selecionado{selectedIds.length > 1 ? "s" : ""} · ~
              {totalSelectedDuration}s
            </span>
            <button type="button" onClick={clearSelection} style={{ background: "none", border: "none", color: "#6B6B6B", fontSize: 12, cursor: "pointer" }}>
              Limpar
            </button>
          </div>

          {!composed ? (
            <button type="button" className="btn-primary" disabled={composing} onClick={handleGenerate}>
              {composing ? "Montando…" : "Gerar prompt final"}
            </button>
          ) : (
            <>
              <textarea
                className="input"
                readOnly
                rows={5}
                value={composed.text}
                style={{ fontSize: 12.5, resize: "vertical" }}
              />
              <div className="hint" style={{ fontSize: 11.5 }}>
                No Flow, cole esse texto <strong>junto com a foto do seu produto/modelo como referência</strong> (recurso
                "Ingredients to Video") — é isso que mantém o mesmo rosto e cenário, o texto sozinho não garante.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setComposed(null)}>
                  Editar seleção
                </button>
                <button type="button" className="btn-primary" onClick={handleCopy}>
                  {copied ? "Copiado ✓" : "Copiar prompt"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
