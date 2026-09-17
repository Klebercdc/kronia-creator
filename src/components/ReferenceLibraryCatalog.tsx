import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TikTokPreview } from "./TikTokPreview";
import {
  listReferenceLibraryFn,
  listReferenceLibraryFiltersFn,
  getReferenceLibraryEntryFn,
  type ReferenceLibraryCard,
} from "../server/reference-library.functions";

const HOOK_LABEL: Record<string, string> = {
  "pain-point": "Dor",
  "before-after": "Antes/Depois",
  "result-first": "Resultado primeiro",
  contrarian: "Contrariante",
  "benefit-first": "Benefício primeiro",
  curiosity: "Curiosidade",
  identity: "Identidade",
  "pov-scenario": "POV",
  authority: "Prova social",
  "urgency-promo": "Urgência",
  "sensory-asmr": "ASMR",
  "skit-conflict": "Esquete",
  "weak-generic": "Genérico",
};

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ReferenceLibraryCatalog({
  onUseReference,
}: {
  onUseReference: (seed: { referenceVideoUrl: string; productInfoText: string }) => void;
}) {
  const listRpc = useServerFn(listReferenceLibraryFn);
  const filtersRpc = useServerFn(listReferenceLibraryFiltersFn);
  const getEntryRpc = useServerFn(getReferenceLibraryEntryFn);

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [cards, setCards] = useState<ReferenceLibraryCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);

  useEffect(() => {
    filtersRpc()
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    listRpc({ data: { category, offset: 0 } })
      .then((page) => {
        setCards(page.cards);
        setTotal(page.total);
      })
      .catch(() => {
        setCards([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [category]);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await listRpc({ data: { category, offset: cards.length } });
      setCards((prev) => [...prev, ...page.cards]);
      setTotal(page.total);
    } finally {
      setLoading(false);
    }
  }

  async function handleUse(card: ReferenceLibraryCard) {
    setUsingId(card.id);
    try {
      const entry = await getEntryRpc({ data: { id: card.id } });
      if (!entry) return;
      const productInfoText = [
        `Referência real (${entry.market.toUpperCase()} · ${humanize(entry.category)}): "${entry.title}".`,
        entry.painPoint ? `Dor que o vídeo original resolve: ${entry.painPoint}.` : null,
        `Formato: ${humanize(entry.videoType)}. Gancho: ${HOOK_LABEL[entry.hook] ?? entry.hook}.`,
        `Use o vídeo de referência abaixo como inspiração de ritmo e estrutura de cenas — nunca copie a fala original.`,
      ]
        .filter(Boolean)
        .join(" ");
      onUseReference({ referenceVideoUrl: entry.source, productInfoText });
    } finally {
      setUsingId(null);
    }
  }

  return (
    <div>
      <div className="hint" style={{ marginBottom: 4 }}>
        Vídeos reais que venderam #1 no TikTok Shop, por categoria — role e veja se mexendo. Toque em "Usar" pra levar
        a referência pro Criar.
      </div>
      <div style={{ fontSize: 10.5, color: "#5A5A5A", marginBottom: 10 }}>
        Prompts de{" "}
        <a href="https://github.com/Clipcat-ai/awesome-tiktok-shop-video-prompts" target="_blank" rel="noopener noreferrer" style={{ color: "#6B6B6B" }}>
          Awesome TikTok Shop Video Prompts
        </a>{" "}
        by Clipcat, CC BY 4.0.
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        <button
          type="button"
          className={`pill ${category === null ? "active" : ""}`}
          onClick={() => setCategory(null)}
          style={{ flex: "0 0 auto" }}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`pill ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
            style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
          >
            {humanize(c)}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "#101010",
              border: "1px solid #232323",
              borderRadius: 12,
              padding: 8,
            }}
          >
            <TikTokPreview videoUrl={card.source} width={148} height={263} />
            <div style={{ fontSize: 11.5, color: "#8A8A8A" }}>
              {card.market.toUpperCase()} · {humanize(card.category)}
            </div>
            <div style={{ fontSize: 11, color: "#6B6B6B" }}>{HOOK_LABEL[card.hook] ?? card.hook}</div>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "6px 10px", fontSize: 12.5 }}
              disabled={usingId === card.id}
              onClick={() => handleUse(card)}
            >
              {usingId === card.id ? "Carregando..." : "Usar essa referência"}
            </button>
          </div>
        ))}
      </div>

      {cards.length === 0 && !loading && <div className="hint">Nenhuma referência encontrada nessa categoria.</div>}

      {cards.length < total && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 14, width: "100%" }}
          disabled={loading}
          onClick={loadMore}
        >
          {loading ? "Carregando..." : `Carregar mais (${cards.length}/${total})`}
        </button>
      )}
    </div>
  );
}
