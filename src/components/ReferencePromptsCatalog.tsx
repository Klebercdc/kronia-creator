import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listReferencePromptCategoriesFn,
  listReferencePromptsByCategoryFn,
  getReferencePromptFn,
  type ReferencePromptCategory,
  type ReferencePromptCard,
  type ReferencePromptEntry,
} from "../server/reference-prompts.functions";

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

export function ReferencePromptsCatalog() {
  const listCategoriesRpc = useServerFn(listReferencePromptCategoriesFn);
  const listCardsRpc = useServerFn(listReferencePromptsByCategoryFn);
  const getEntryRpc = useServerFn(getReferencePromptFn);

  const [categories, setCategories] = useState<ReferencePromptCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [cards, setCards] = useState<ReferencePromptCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [entry, setEntry] = useState<ReferencePromptEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listCategoriesRpc().then(setCategories);
  }, []);

  useEffect(() => {
    if (!categorySlug) return;
    setLoading(true);
    setOpenId(null);
    setEntry(null);
    listCardsRpc({ data: { categorySlug } })
      .then((page) => {
        setCards(page.cards);
        setTotal(page.total);
      })
      .finally(() => setLoading(false));
  }, [categorySlug]);

  async function loadMore() {
    if (!categorySlug) return;
    setLoading(true);
    try {
      const page = await listCardsRpc({ data: { categorySlug, offset: cards.length } });
      setCards((prev) => [...prev, ...page.cards]);
      setTotal(page.total);
    } finally {
      setLoading(false);
    }
  }

  async function openEntry(id: string) {
    if (openId === id) {
      setOpenId(null);
      setEntry(null);
      return;
    }
    setOpenId(id);
    setCopied(false);
    setLoadingEntry(true);
    try {
      const full = await getEntryRpc({ data: { id } });
      setEntry(full);
    } finally {
      setLoadingEntry(false);
    }
  }

  async function handleCopy() {
    if (!entry) return;
    try {
      await navigator.clipboard.writeText(entry.prompt);
      setCopied(true);
    } catch {
      // clipboard indisponível — o texto já está visível pra copiar manualmente.
    }
  }

  if (!categorySlug) {
    return (
      <div>
        <div className="hint" style={{ marginBottom: 10 }}>
          Roteiros completos (10-25s) reverse-engineered de vídeos reais que venderam #1 por categoria — prontos pra
          colar no Flow, sem precisar montar por movimento. Escolhe a categoria do seu produto.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategorySlug(c.slug)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #232323",
                background: "#131313",
                color: "#C9C9C9",
                fontSize: 13,
                fontWeight: 600,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span>{c.label}</span>
              <span style={{ fontSize: 11.5, color: "#6B6B6B", fontWeight: 500 }}>{c.count}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const categoryLabel = categories.find((c) => c.slug === categorySlug)?.label ?? "";

  return (
    <div>
      <button
        type="button"
        onClick={() => setCategorySlug(null)}
        style={{ background: "none", border: "none", color: "#8A8A8A", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 10 }}
      >
        ← {categoryLabel}
      </button>

      <div className="hint" style={{ marginBottom: 10, fontSize: 11.5 }}>
        Alguns roteiros citam a fala do vídeo original (linhas "Subject" dentro do texto) — use só como referência de
        ritmo/estrutura, não copie a fala literal como texto final seu.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.map((card) => {
          const open = openId === card.id;
          return (
            <div key={card.id} style={{ border: "1px solid #232323", borderRadius: 12, background: "#131313", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => openEntry(card.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  width: "100%",
                  padding: "12px 14px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "#E5E5E5",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{card.title}</div>
                <div style={{ fontSize: 11, color: "#8A8A8A" }}>
                  {card.market.toUpperCase()} · {HOOK_LABEL[card.hook] ?? card.hook} · ~{card.durationSec}s
                </div>
                {card.painPoint && <div style={{ fontSize: 11.5, color: "#6B6B6B" }}>{card.painPoint}</div>}
              </button>

              {open && (
                <div style={{ padding: "0 14px 14px" }}>
                  {loadingEntry ? (
                    <div className="hint">Carregando…</div>
                  ) : entry ? (
                    <>
                      <textarea
                        className="input"
                        readOnly
                        rows={8}
                        value={entry.prompt}
                        style={{ fontSize: 11.5, resize: "vertical", fontFamily: "monospace" }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ marginTop: 8 }}
                        onClick={handleCopy}
                      >
                        {copied ? "Copiado ✓" : "Copiar prompt"}
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cards.length === 0 && !loading && <div className="hint">Nenhum roteiro nessa categoria.</div>}

      {cards.length < total && (
        <button type="button" className="btn-secondary" style={{ marginTop: 14, width: "100%" }} disabled={loading} onClick={loadMore}>
          {loading ? "Carregando…" : `Carregar mais (${cards.length}/${total})`}
        </button>
      )}
    </div>
  );
}
