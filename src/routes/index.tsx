import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, type FormEvent } from "react";
import {
  enqueueReferenceIngestion,
  advanceIngestionJob,
  enqueueContentGeneration,
  advanceContentGenerationJob,
  analyzeActorPhoto,
  analyzeProductPhoto,
  refineScene,
  generateSeoPackage,
  listSavedThemesFn,
  addSavedThemeFn,
  removeSavedThemeFn,
  addHistoryEntryFn,
  listHistoryFn,
  removeHistoryEntryFn,
  type RunPipelineResult,
} from "../server/pipeline.functions";
import { ACTOR_PRESETS } from "../core/generation/actor-presets";
import { uploadReferenceVideo } from "../lib/supabase-client";
import type { SavedTheme, HistoryEntry } from "../lib/supabase";
import type { ContentRequest, GenerationResult, PipelineOutput, ReferenceAnalysis } from "../types/pipeline";
import { findOpportunities, type OpportunityWithScore, type FindOpportunitiesResult } from "../server/intelligence.functions";
import { opportunityToPrecomputedAnalysis } from "../core/intelligence/opportunities/bridge";
import { recommendationBadge } from "../core/intelligence/opportunities/schemas";
import { buildCreativePromptFn } from "../server/creative.functions";
import type { BuildCreativePromptResult } from "../core/intelligence/creative/orchestrator";
import { TARGET_PROFILES } from "../core/intelligence/creative/target-profiles";
import type { VideoAnalysis } from "../types/video-analysis";
import logoIcon from "../assets/logo-icon.png";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/")({
  component: CriadorApp,
});

type Step = "form" | "loading" | "resultado" | "roteiro" | "manual" | "error";

const CONFIDENCE_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

function BrandRow({ onBack, onProfile }: { onBack?: () => void; onProfile?: () => void } = {}) {
  return (
    <div className="brand-row">
      {onBack && (
        <button type="button" onClick={onBack} className="brand-back" aria-label="Voltar">
          <IconChevronLeft />
        </button>
      )}
      <img src={logoIcon} alt="Kronia" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
      <div style={{ flex: 1, lineHeight: 1 }}>
        <div className="brand-word">KRONIA</div>
        <div className="brand-sub">CRIADOR INTELIGENTE</div>
      </div>
      {onProfile && (
        <button type="button" onClick={onProfile} className="brand-avatar" aria-label="Perfil">
          <IconUser />
        </button>
      )}
    </div>
  );
}

const STAGES = ["Criar", "Analisar", "Resultado"] as const;

function StageIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
      {STAGES.map((label, i) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                border: i <= current ? "none" : "1px solid #3A3A3A",
                background: i <= current ? "#FF6A1A" : "transparent",
                color: i <= current ? "#fff" : "#7A7A7A",
              }}
            >
              {i + 1}
            </span>
            <span style={{ color: i <= current ? "#fff" : "#7A7A7A" }}>{label}</span>
          </span>
          {i < STAGES.length - 1 && <span style={{ width: 16, height: 1, background: "#333", flexShrink: 0 }} />}
        </span>
      ))}
    </div>
  );
}

type AppTab = "criar" | "historico" | "explorar" | "prompt" | "perfil";

/** Ícones — traçados copiados 1:1 do handoff de design (KroniaMockup.dc.html),
 * não reinventados, pra bater pixel a pixel com o mockup aprovado. */
function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-3 5-5 3 3-5 5-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
    </svg>
  );
}

function IconWand() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20L15 9" strokeLinecap="round" />
      <path d="M15 4v3M20 9h-3M18.5 5.5l-2 2" strokeLinecap="round" />
      <path d="M9 4v2M7 6h2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7.2c0-.9.7-1.6 1.6-1.6h1.6l1-1.6h5.6l1 1.6h1.6c.9 0 1.6.7 1.6 1.6v7.6c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6z" strokeLinejoin="round" />
      <circle cx="10" cy="11" r="3" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAddPhoto() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF9A1A">
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z" />
    </svg>
  );
}

function IconShieldCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" fill="#22C55E" />
      <path d="M8.5 12l2.5 2.5 5-5" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheckCircleSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#22C55E" />
      <path d="M7 12.5l3 3 7-7" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconApprovedBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#22C55E" />
      <path d="M7 12.5l3 3 7-7" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TAB_ITEMS: { id: AppTab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: "criar", label: "Criar", Icon: IconHome },
  { id: "historico", label: "Histórico", Icon: IconClock },
  { id: "explorar", label: "Explorar", Icon: IconCompass },
  { id: "prompt", label: "Prompt", Icon: IconWand },
  { id: "perfil", label: "Perfil", Icon: IconUser },
];

function BottomNav({ active, onChange }: { active: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <nav className="bottom-nav">
      {TAB_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span className="bottom-nav-icon">
            <item.Icon />
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function PlaceholderTab({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="app">
      <BrandRow />
      <h1 className="h1" style={{ fontSize: 20 }}>
        {title}
      </h1>
      <div className="card" style={{ color: "#8A8A8A", fontSize: 14 }}>
        {hint}
      </div>
    </div>
  );
}

function SavedThemesDrawer({
  savedThemes,
  currentText,
  onSave,
  onPick,
  onRemove,
}: {
  savedThemes: SavedTheme[];
  currentText: string;
  onSave: () => void;
  onPick: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: "6px 10px", fontSize: 13 }}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "▾" : "▸"} Temas salvos {savedThemes.length > 0 ? `(${savedThemes.length})` : ""}
        </button>
        {currentText.trim() && (
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: "6px 10px", fontSize: 13 }}
            onClick={onSave}
          >
            + Salvar este
          </button>
        )}
      </div>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "1px solid #252525",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {savedThemes.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#8A8A8A" }}>Nada salvo ainda.</div>
          ) : (
            savedThemes.map((theme) => (
              <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: "flex-start", textAlign: "left", padding: "6px 10px", fontSize: 13.5 }}
                  onClick={() => onPick(theme.text)}
                >
                  {theme.text}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(theme.id)}
                  style={{ background: "none", border: "none", color: "#8A8A8A", cursor: "pointer", fontSize: 16, padding: "0 6px" }}
                  aria-label="Remover"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const FORMAT_LABEL: Record<string, string> = {
  product_showcase: "Vitrine de produto",
  ugc: "UGC",
  pov: "POV",
  unboxing: "Unboxing",
  tutorial: "Tutorial",
  demonstracao: "Demonstração",
  cinematografico: "Cinematográfico",
  produto_em_uso: "Produto em uso",
  antes_e_depois: "Antes e depois",
  review: "Review",
  teste: "Teste",
  comparacao: "Comparação",
  storytelling: "Storytelling",
  produto_360: "Produto 360°",
  apresentacao_por_modelo: "Apresentação por modelo",
};

const HOOK_TYPE_LABEL: Record<string, string> = {
  curiosity: "Curiosidade",
  pattern_interrupt: "Quebra de padrão",
  bold_statement: "Afirmação forte",
  question: "Pergunta",
  social_proof: "Prova social",
  before_after: "Antes e depois",
  negative_hook: "Alerta/erro",
  relatable_pain: "Dor identificável",
  story_open: "Abertura de história",
  result_first: "Resultado primeiro",
  identity_call: "Chamada por identidade",
  number_stat: "Número/estatística",
};

const CREATIVE_PATTERN_LABEL: Record<string, string> = {
  prove_the_product: "Provar o produto",
  discovery: "Descoberta",
  reveal: "Revelação",
  transformation: "Transformação",
  demonstration: "Demonstração",
  problem_solution: "Problema → Solução",
  curiosity: "Curiosidade",
  comparison: "Comparação",
  unboxing: "Unboxing",
  first_use: "Primeiro uso",
  reaction: "Reação",
  social_proof: "Prova social",
  before_after: "Antes e depois",
};

const VISUAL_MECHANIC_LABEL: Record<string, string> = {
  unboxing: "Unboxing",
  product_rotation: "Rotação do produto",
  detail_reveal: "Revelação de detalhe",
  functional_demo: "Demonstração funcional",
  before_after: "Antes e depois",
  pour: "Despejar",
  open_close: "Abrir/fechar",
  hand_feel: "Toque/textura na mão",
  try_on: "Experimentar/vestir",
  comparison: "Comparação",
  pov_use: "Uso em primeira pessoa (POV)",
  reaction: "Reação",
};

const QC_STATE_LABEL: Record<string, string> = {
  pass: "Aprovado",
  warning: "Aprovado com observações",
  fail: "Reprovado",
  repair_required: "Correção necessária",
};

/** Nunca "automático inteligente" — default_target é só o fallback fixo,
 * automatic_target_selection é o único caso com ranking real de capability. */
const TARGET_SELECTION_LABEL: Record<string, string> = {
  user_selected: "escolhido por você",
  automatic_target_selection: "escolhido automaticamente por compatibilidade",
  default_target: "padrão",
};

function OportunidadesTab({ onCreateContent }: { onCreateContent: (seed: PendingOpportunitySeed) => void }) {
  const findOpportunitiesFn = useServerFn(findOpportunities);

  const [niche, setNiche] = useState("");
  const [objective, setObjective] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [trendText, setTrendText] = useState("");
  const [growthHint, setGrowthHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FindOpportunitiesResult | null>(null);

  async function handleFind(e: FormEvent) {
    e.preventDefault();
    if (!niche.trim() || !objective.trim() || !product.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const res = await findOpportunitiesFn({
        data: {
          trendInput: {
            niche: niche.trim(),
            objective: objective.trim(),
            product: product.trim(),
            audience: audience.trim() || null,
            trendText: trendText.trim() || null,
            growthHint: growthHint.trim() || null,
          },
        },
      });
      setResult(res);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao buscar oportunidades");
    } finally {
      setLoading(false);
    }
  }

  function handleCreateContent(opportunity: OpportunityWithScore) {
    const precomputedAnalysis = opportunityToPrecomputedAnalysis(opportunity);
    // Contexto comercial rico pro Marketing agent (nicho/público/produto/
    // ângulo/CTA) — sem criar um Copywriter separado, é o mesmo canal de
    // texto livre (EvidencedClaim) que o campo "Informações do produto" já
    // usava, só que mais completo.
    const productInfoText = [
      `Produto: ${product}.`,
      `Nicho: ${niche}.`,
      audience ? `Público-alvo: ${audience}.` : null,
      `Tema/oportunidade: ${opportunity.title}.`,
      `Ângulo: ${opportunity.angle}.`,
      `Hook sugerido: "${opportunity.hookText}".`,
      `CTA sugerido: ${opportunity.cta}.`,
      `Atenção/risco a evitar nesta criação: ${opportunity.risk}.`,
    ]
      .filter(Boolean)
      .join(" ");
    onCreateContent({ productInfoText, precomputedAnalysis });
  }

  return (
    <div className="app">
      <BrandRow />
      <h1 className="h1" style={{ fontSize: 20, marginBottom: 4 }}>
        Oportunidades
      </h1>
      <div className="hint" style={{ marginBottom: 16 }}>
        O TikTok mostra a tendência. O KRONIA decide o que fazer com ela.
      </div>

      <form onSubmit={handleFind} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div className="section-label">Nicho</div>
          <input
            className="input"
            placeholder="Ex: nutrição esportiva"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
        </div>
        <div>
          <div className="section-label">Objetivo</div>
          <input
            className="input"
            placeholder="Ex: vender consultoria online"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>
        <div>
          <div className="section-label">Produto</div>
          <textarea
            className="input"
            rows={2}
            placeholder="Ex: Cristal de quartzo — pedra natural, uso decorativo, vendido em kit com suporte de madeira"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
          <div className="hint">Descreva as características reais que você sabe — nada além disso é usado.</div>
        </div>
        <div>
          <div className="section-label">Público (opcional)</div>
          <input
            className="input"
            placeholder="Ex: mulheres 25-40 interessadas em bem-estar"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
          <div className="hint">Quem você quer alcançar — se não souber, a IA infere a partir do nicho e do produto.</div>
        </div>
        <div>
          <div className="section-label">Tendência (opcional)</div>
          <textarea
            className="input"
            rows={2}
            placeholder="Ex: Café proteico crescendo forte no TikTok"
            value={trendText}
            onChange={(e) => setTrendText(e.target.value)}
          />
        </div>
        <div>
          <div className="section-label">Crescimento (opcional)</div>
          <input
            className="input"
            placeholder="Ex: +1.350%"
            value={growthHint}
            onChange={(e) => setGrowthHint(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Analisando..." : "Encontrar oportunidades"}
        </button>
      </form>

      {errorMessage && (
        <div className="card" style={{ marginTop: 16, color: "#E5484D" }}>
          Algo deu errado: {errorMessage}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="hint">
            🔥 {result.opportunities.length} oportunidade{result.opportunities.length === 1 ? "" : "s"} encontrada
            {result.opportunities.length === 1 ? "" : "s"}
          </div>
          {result.opportunities
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((opp, i) => (
              <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{opp.title}</div>
                  <div style={{ flex: "0 0 auto", fontWeight: 700, color: "#FF7A1A", textAlign: "right" }}>
                    {opp.score}/100
                    <div style={{ fontWeight: 400, fontSize: 12, color: "#B5B5B5" }}>
                      {recommendationBadge(opp.score).emoji} {recommendationBadge(opp.score).label}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13.5, color: "#B5B5B5" }}>{opp.reasoning}</div>
                <div style={{ fontSize: 12.5, color: "#8A8A8A" }}>
                  Ângulo: {opp.angle} · Formato: {FORMAT_LABEL[opp.format] ?? opp.format} · Gancho:{" "}
                  {HOOK_TYPE_LABEL[opp.hookType] ?? opp.hookType}
                </div>
                <div style={{ fontSize: 13, fontStyle: "italic" }}>"{opp.hookText}"</div>
                <div style={{ fontSize: 12.5, color: "#8A8A8A" }}>
                  <strong style={{ color: "#B5B5B5" }}>CTA:</strong> {opp.cta}
                </div>
                <div style={{ fontSize: 12.5, color: "#8A8A8A" }}>
                  <strong style={{ color: "#B5B5B5" }}>Atenção:</strong> {opp.risk}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 4 }}
                  onClick={() => handleCreateContent(opp)}
                >
                  Criar conteúdo
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function HistoricoTab() {
  const listHistoryRpc = useServerFn(listHistoryFn);
  const removeHistoryRpc = useServerFn(removeHistoryEntryFn);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listHistoryRpc()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  async function handleRemove(id: string) {
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    try {
      await removeHistoryRpc({ data: { id } });
    } catch {
      // best-effort
    }
  }

  return (
    <div className="app">
      <BrandRow />
      <h1 className="h1" style={{ fontSize: 20 }}>
        Histórico
      </h1>
      <div className="h1-sub">Roteiros gerados antes — reveja o prompt e a legenda sem gerar de novo.</div>

      {entries === null && <div className="hint">Carregando...</div>}
      {entries?.length === 0 && (
        <div className="card" style={{ color: "#8A8A8A", fontSize: 14 }}>
          Nada gerado ainda. Vá em "Criar" pra começar.
        </div>
      )}
      {entries?.map((entry) => {
        const output = entry.output as PipelineOutput | null;
        const open = openId === entry.id;
        return (
          <div key={entry.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div className="scene-tag">{formatLabel(entry.format)}</div>
                <div style={{ fontSize: 13.5, color: "#B5B5B5" }}>
                  {entry.theme || "(sem tema)"} · {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(entry.id)}
                style={{ background: "none", border: "none", color: "#8A8A8A", cursor: "pointer", fontSize: 16 }}
                aria-label="Remover"
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 14, fontStyle: "italic", marginTop: 8 }}>"{entry.selectedHook}"</div>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 10, padding: "8px 12px", fontSize: 13.5 }}
              onClick={() => setOpenId(open ? null : entry.id)}
            >
              {open ? "Fechar" : "Ver prompts"}
            </button>
            {open && output && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {output.generation.flowSegments.map((s) => (
                  <div
                    key={s.index}
                    style={{
                      fontSize: 13,
                      background: "#070707",
                      border: "1px solid #252525",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      Bloco {s.index + 1} ({s.startSeconds}s-{s.endSeconds}s)
                    </div>
                    {s.videoPrompt}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Prompt Intelligence — módulo independente, fora do pipeline de
 * Roteirista/Marketing/Persuasão/Cinematográfico. Responde "como executar
 * visualmente" uma ideia/produto, não "o que criar" (isso é Oportunidades)
 * nem "como escrever o roteiro falado" (isso é Criar). Só os 2 modos que
 * não dependem de análise de imagem/vídeo de referência (Fase 1) — "a
 * partir de imagem/vídeo" e "melhorar meu prompt" ficam pra uma fase
 * futura de Reference Intelligence.
 */
/** Rótulos de progresso da Ingestão reaproveitados no fluxo de Reference
 * Intelligence do Prompt Tab — mesmo vocabulário já usado em CriarFlow
 * (INGESTION_STEP_LABELS), sem duplicar a lista. */
const PROMPT_REFERENCE_STEP_LABELS: Record<string, string> = {
  download: "Baixando e extraindo frames do vídeo...",
  transcript: "Transcrevendo o áudio...",
  vision: "Analisando a mecânica do vídeo...",
};

function PromptTab() {
  const buildCreativePromptRpc = useServerFn(buildCreativePromptFn);
  const enqueueReferenceIngestionRpc = useServerFn(enqueueReferenceIngestion);
  const advanceIngestionJobRpc = useServerFn(advanceIngestionJob);

  const [idea, setIdea] = useState("");
  const [productInfoText, setProductInfoText] = useState("");
  const [objective, setObjective] = useState("");
  const [media, setMedia] = useState<"image" | "video">("video");
  const [targetId, setTargetId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BuildCreativePromptResult | null>(null);

  // Reference Intelligence (Fase 2B) — vídeo de referência opcional.
  // Reaproveita o MESMO Job Engine (ingest_reference_video) já usado em
  // CriarFlow, nenhuma ingestão paralela: só consome `.ingestion`
  // (VideoAnalysis) do resultado, que é exatamente a gramática técnica que
  // reference-grammar.ts sabe traduzir — classification/recommendation do
  // job (que servem o pipeline de conteúdo, não a Creative Intelligence)
  // são descartados aqui.
  const [referenceVideoFile, setReferenceVideoFile] = useState<{ name: string; storagePath: string } | null>(null);
  const [referenceAnalysis, setReferenceAnalysis] = useState<VideoAnalysis | null>(null);
  const [referenceStep, setReferenceStep] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);

  async function runReferenceIngestion(storagePath: string) {
    setReferenceStep("download");
    setReferenceError(null);
    try {
      const { jobId } = await enqueueReferenceIngestionRpc({
        data: {
          // Campos exigidos pelo contrato ContentRequest do Job Engine
          // (reaproveitado, não duplicado) mas irrelevantes pra Creative
          // Intelligence — classification/recommendation resultantes são
          // descartados abaixo, só `.ingestion` (VideoAnalysis) é usado.
          project: "comercial",
          objective: "vender",
          mode: "tiktok_shop",
          productPhotoUrls: [],
          productInfo: productInfoText.trim() ? [{ text: productInfoText.trim(), kind: "fato" as const, source: "campo de informações" }] : [],
          referenceVideoUrl: null,
          referenceVideoStoragePath: storagePath,
          actorProfile: null,
          targetDurationSeconds: null,
        },
      });

      for (;;) {
        const job = await advanceIngestionJobRpc({ data: { jobId } });
        if (job) {
          setReferenceStep(job.step);
          if (job.status === "succeeded") {
            setReferenceStep(null);
            setReferenceAnalysis(job.result?.ingestion ?? null);
            return;
          }
          if (job.status === "failed") {
            setReferenceStep(null);
            throw new Error(job.error ?? "Falha ao analisar o vídeo de referência.");
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (err) {
      setReferenceStep(null);
      setReferenceError(err instanceof Error ? err.message : "Erro ao analisar o vídeo de referência");
    }
  }

  async function handleReferenceVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingReference(true);
    setReferenceError(null);
    setReferenceAnalysis(null);
    try {
      const storagePath = await uploadReferenceVideo(file);
      setReferenceVideoFile({ name: file.name, storagePath });
      await runReferenceIngestion(storagePath);
    } catch (err) {
      setReferenceError(err instanceof Error ? err.message : "Erro ao enviar o vídeo");
    } finally {
      setUploadingReference(false);
    }
  }

  function removeReferenceVideo() {
    setReferenceVideoFile(null);
    setReferenceAnalysis(null);
    setReferenceError(null);
    setReferenceStep(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productInfoText.trim() || !objective.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const res = await buildCreativePromptRpc({
        data: {
          media,
          productInfo: [{ text: productInfoText.trim(), kind: "fato", source: "campo de informações" }],
          idea: idea.trim() || null,
          opportunityContext: null,
          objective: objective.trim(),
          // "" = Padrão (DEFAULT_TARGET) — nunca apresentado como "melhor modelo",
          // é só o fallback fixo da Fase 1 (ver ARCHITECTURE/plano desta feature).
          targetId: targetId || null,
          // Reference Intelligence (Fase 2B) — null se nenhum vídeo foi
          // enviado/analisado ainda; motor trata os dois casos.
          referenceAnalysis,
        },
      });
      setResult(res);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao gerar o prompt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <BrandRow />
      <h1 className="h1" style={{ fontSize: 20, marginBottom: 4 }}>
        Prompt
      </h1>
      <div className="hint" style={{ marginBottom: 16 }}>
        Transforme um produto ou uma ideia numa direção visual pronta pra colar num gerador de imagem/vídeo.
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div className="section-label">Produto</div>
          <textarea
            className="input"
            rows={2}
            placeholder="Ex: mochila de nylon, compartimento para notebook, cor preta"
            value={productInfoText}
            onChange={(e) => setProductInfoText(e.target.value)}
          />
          <div className="hint">Descreva só o que você sabe de verdade — nada além disso é usado.</div>
        </div>
        <div>
          <div className="section-label">Objetivo</div>
          <input
            className="input"
            placeholder="Ex: vender, mostrar uso no dia a dia"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>
        <div>
          <div className="section-label">Ideia (opcional)</div>
          <textarea
            className="input"
            rows={2}
            placeholder="Ex: quero mostrar o produto sendo usado no dia a dia"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>
        <div>
          <div className="section-label">Vídeo de referência (opcional)</div>
          <div className="hint" style={{ marginBottom: 6 }}>
            Analisamos a TÉCNICA do vídeo (câmera, ritmo, estrutura) pra inspirar a execução — nunca copiamos fala ou identidade dele.
          </div>
          {!referenceVideoFile ? (
            <label className="btn-secondary" style={{ display: "inline-block", cursor: "pointer" }}>
              {uploadingReference ? "Enviando..." : "Enviar vídeo"}
              <input type="file" accept="video/*" onChange={handleReferenceVideoFile} disabled={uploadingReference} style={{ display: "none" }} />
            </label>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>{referenceVideoFile.name}</span>
              <button type="button" className="btn-secondary" onClick={removeReferenceVideo}>
                Remover
              </button>
            </div>
          )}
          {referenceStep && (
            <div className="hint" style={{ marginTop: 6 }}>
              {PROMPT_REFERENCE_STEP_LABELS[referenceStep] ?? "Processando..."}
            </div>
          )}
          {referenceError && (
            <div className="hint" style={{ marginTop: 6, color: "#E5484D" }}>
              {referenceError}
            </div>
          )}
          {referenceAnalysis && (
            <div className="hint" style={{ marginTop: 6, color: "#22C55E" }}>
              Referência analisada: formato "{referenceAnalysis.format.primary}", hook "{referenceAnalysis.hook.type}",{" "}
              {referenceAnalysis.visual.cutsPerMinute.toFixed(0)} cortes/min.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="section-label">Mídia</div>
            <select className="input" value={media} onChange={(e) => setMedia(e.target.value as "image" | "video")}>
              <option value="video">Vídeo</option>
              <option value="image">Imagem</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div className="section-label">Target</div>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Padrão</option>
              {TARGET_PROFILES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.kind === "platform" ? "plataforma" : "modelo"})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Gerando..." : "Gerar prompt"}
        </button>
      </form>

      {errorMessage && (
        <div className="card" style={{ marginTop: 16, color: "#E5484D" }}>
          Algo deu errado: {errorMessage}
        </div>
      )}

      {result && !result.artifact && (
        <div className="card" style={{ marginTop: 16, color: "#E5484D" }}>
          Não foi possível gerar uma execução visual coerente: {result.evaluation.notes.join(" ")}
        </div>
      )}

      {result?.artifact && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: "#8A8A8A" }}>
              Padrão: {CREATIVE_PATTERN_LABEL[result.spec.pattern] ?? result.spec.pattern} · Mecânica:{" "}
              {VISUAL_MECHANIC_LABEL[result.spec.mechanic] ?? result.spec.mechanic} · Formato:{" "}
              {FORMAT_LABEL[result.spec.format] ?? result.spec.format}
            </div>
            <div style={{ fontSize: 13.5, color: "#B5B5B5" }}>{result.spec.reasoning}</div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Prompt final</div>
              <div style={{ fontSize: 12.5, color: result.artifact.status === "ready" ? "#22C55E" : "#F5A524" }}>
                {result.artifact.status === "ready" ? "Pronto" : "Requer revisão manual"} ·{" "}
                {QC_STATE_LABEL[result.artifact.qc.state] ?? result.artifact.qc.state}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#8A8A8A" }}>
              Target: {result.artifact.targetId} (
              {TARGET_SELECTION_LABEL[result.artifact.targetSelectionMode] ?? result.artifact.targetSelectionMode})
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, fontFamily: "inherit", margin: 0 }}>{result.artifact.promptText}</pre>
            {result.artifact.negativePrompt && (
              <div style={{ fontSize: 12.5, color: "#8A8A8A" }}>
                <strong style={{ color: "#B5B5B5" }}>Evitar:</strong> {result.artifact.negativePrompt}
              </div>
            )}
            {result.artifact.qc.issues.length > 0 && (
              <div style={{ fontSize: 12.5, color: "#8A8A8A" }}>
                <strong style={{ color: "#B5B5B5" }}>Observações do QC:</strong> {result.artifact.qc.issues.join(" ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** O que a aba Oportunidades passa pra aba Criar quando o usuário clica
 * "Criar conteúdo" — pré-preenche o tema e já leva a classificação/
 * recomendação sintetizadas (bridge, sem chamada de servidor), pra
 * `runContentPipeline` não refazer Ingestão/Classificação/Recomendação
 * (não existe vídeo de referência aqui pra analisar mesmo). */
interface PendingOpportunitySeed {
  productInfoText: string;
  precomputedAnalysis: ReferenceAnalysis;
}

function CriadorApp() {
  const [tab, setTab] = useState<AppTab>("criar");
  const [pendingOpportunity, setPendingOpportunity] = useState<PendingOpportunitySeed | null>(null);
  return (
    <>
      {tab === "criar" && (
        <CriarFlow
          onOpenProfile={() => setTab("perfil")}
          pendingOpportunity={pendingOpportunity}
          onConsumePendingOpportunity={() => setPendingOpportunity(null)}
        />
      )}
      {tab === "historico" && <HistoricoTab />}
      {tab === "explorar" && (
        <OportunidadesTab
          onCreateContent={(seed) => {
            setPendingOpportunity(seed);
            setTab("criar");
          }}
        />
      )}
      {tab === "prompt" && <PromptTab />}
      {tab === "perfil" && (
        <PlaceholderTab title="Perfil" hint="Em breve: atores salvos, preferências e configurações da conta." />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}

function CriarFlow({
  onOpenProfile,
  pendingOpportunity,
  onConsumePendingOpportunity,
}: {
  onOpenProfile: () => void;
  pendingOpportunity: PendingOpportunitySeed | null;
  onConsumePendingOpportunity: () => void;
}) {
  const enqueueReferenceIngestionFn = useServerFn(enqueueReferenceIngestion);
  const advanceIngestionJobFn = useServerFn(advanceIngestionJob);
  const enqueueContentGenerationFn = useServerFn(enqueueContentGeneration);
  const advanceContentGenerationJobFn = useServerFn(advanceContentGenerationJob);
  const analyzeActorPhotoFn = useServerFn(analyzeActorPhoto);
  const analyzeProductPhotoFn = useServerFn(analyzeProductPhoto);
  const listSavedThemesRpc = useServerFn(listSavedThemesFn);
  const addSavedThemeRpc = useServerFn(addSavedThemeFn);
  const removeSavedThemeRpc = useServerFn(removeSavedThemeFn);
  const addHistoryEntryRpc = useServerFn(addHistoryEntryFn);

  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<RunPipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [project, setProject] = useState<ContentRequest["project"]>("comercial");
  const [objective, setObjective] = useState<ContentRequest["objective"]>("vender");
  const [mode, setMode] = useState<ContentRequest["mode"]>("tiktok_shop");
  const [productInfoText, setProductInfoText] = useState("");
  const [productPhotoDataUrls, setProductPhotoDataUrls] = useState<string[]>([]);
  const [productPhotoDescription, setProductPhotoDescription] = useState<string | null>(null);
  const [analyzingProductPhoto, setAnalyzingProductPhoto] = useState(false);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState<number | null>(null);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [referenceVideoFile, setReferenceVideoFile] = useState<{ name: string; storagePath: string } | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [ingestionStep, setIngestionStep] = useState<string | null>(null);
  const [ingestionProgressPercent, setIngestionProgressPercent] = useState<number | null>(null);
  const [actorName, setActorName] = useState("");
  const [actorVoice, setActorVoice] = useState("");
  const [actorAppearance, setActorAppearance] = useState("");
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [opportunityAnalysis, setOpportunityAnalysis] = useState<ReferenceAnalysis | null>(null);

  useEffect(() => {
    listSavedThemesRpc()
      .then(setSavedThemes)
      .catch(() => {
        // best-effort — sem tema salvo carregado não quebra o resto do app
      });
  }, []);

  // Veio da aba Oportunidades — pré-preenche o tema e guarda a
  // classificação/recomendação sintetizadas (bridge, sem vídeo de
  // referência) pra usar no lugar da análise de Ingestão quando o usuário
  // clicar em "Criar". Consumido uma vez só (o pai limpa o estado).
  useEffect(() => {
    if (!pendingOpportunity) return;
    setProductInfoText(pendingOpportunity.productInfoText);
    setOpportunityAnalysis(pendingOpportunity.precomputedAnalysis);
    onConsumePendingOpportunity();
  }, [pendingOpportunity]);

  async function saveCurrentTheme() {
    const text = productInfoText.trim();
    if (!text || savedThemes.some((t) => t.text === text)) return;
    try {
      const saved = await addSavedThemeRpc({ data: { text } });
      setSavedThemes((prev) => [saved, ...prev]);
    } catch {
      // best-effort
    }
  }

  async function removeSavedTheme(id: string) {
    setSavedThemes((prev) => prev.filter((t) => t.id !== id));
    try {
      await removeSavedThemeRpc({ data: { id } });
    } catch {
      // best-effort — já removeu da tela, tenta de novo depois se falhar
    }
  }

  async function handleActorPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzingPhoto(true);
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const { appearanceDescription } = await analyzeActorPhotoFn({ data: { imageDataUrl } });
      setActorAppearance(appearanceDescription);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao analisar a foto");
    } finally {
      setAnalyzingPhoto(false);
    }
  }

  const INGESTION_STEP_LABELS: Record<string, string> = {
    download: "Baixando e extraindo frames do vídeo...",
    transcript: "Transcrevendo o áudio...",
    vision: "Analisando a mecânica do vídeo...",
  };

  const CONTENT_GENERATION_STEP_LABELS: Record<string, string> = {
    recommend: "Recomendando o melhor formato...",
    roteirista: "Escrevendo o roteiro e os hooks...",
    marketing: "Ajustando o ângulo de marketing...",
    teologo: "Revisando a mensagem teológica...",
    psicologia: "Aplicando gatilhos de decisão de compra...",
    persuasao: "Refinando a persuasão...",
    cinematografico: "Montando a direção cinematográfica...",
    compliance_validate: "Validando conformidade...",
    compliance_correct: "Corrigindo pontos de conformidade...",
  };

  /** Enfileira a Ingestão e faz polling até o job terminar — cada chamada
   * de advanceIngestionJobFn roda só um step no servidor (cabe nos 60s),
   * essa aba fechar no meio, um worker de verdade (pg_cron do Supabase,
   * independente do navegador) continua avançando o job sozinho — esse
   * loop aqui é só o caminho rápido enquanto a tela está aberta. */
  async function runIngestionJob(request: ContentRequest) {
    const { jobId } = await enqueueReferenceIngestionFn({ data: request });
    setIngestionStep("download");

    for (;;) {
      const job = await advanceIngestionJobFn({ data: { jobId } });
      if (job) {
        setIngestionStep(job.step);
        setIngestionProgressPercent(job.progressPercent);
        if (job.status === "succeeded") {
          setIngestionStep(null);
          setIngestionProgressPercent(null);
          return job.result ?? undefined;
        }
        if (job.status === "failed") {
          setIngestionStep(null);
          setIngestionProgressPercent(null);
          throw new Error(job.error ?? "Falha ao analisar o vídeo de referência.");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  /** Recomendação → Geração → Compliance como job assíncrono — mesmo
   * padrão de `runIngestionJob` acima, mesmo motivo: a cadeia de 6
   * agentes + até 2 rodadas de Compliance estourava o timeout de 60s
   * numa chamada síncrona só (confirmado em produção). Reaproveita o
   * MESMO estado de progresso (`ingestionStep`/`ingestionProgressPercent`)
   * da tela de "Analisando...", só troca o mapa de rótulos. */
  async function runContentGenerationJob(
    request: ContentRequest,
    precomputedAnalysis?: ReferenceAnalysis,
  ): Promise<RunPipelineResult> {
    const { jobId } = await enqueueContentGenerationFn({ data: { request, precomputedAnalysis } });
    setIngestionStep("recommend");

    for (;;) {
      const job = await advanceContentGenerationJobFn({ data: { jobId } });
      if (job) {
        setIngestionStep(job.step);
        setIngestionProgressPercent(job.progressPercent);
        if (job.status === "succeeded") {
          setIngestionStep(null);
          setIngestionProgressPercent(null);
          if (!job.result) throw new Error("Job de geração terminou sem resultado.");
          return job.result;
        }
        if (job.status === "failed") {
          setIngestionStep(null);
          setIngestionProgressPercent(null);
          throw new Error(job.error ?? "Falha ao gerar o conteúdo.");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  async function handleReferenceVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingVideo(true);
    setErrorMessage(null);
    try {
      const storagePath = await uploadReferenceVideo(file);
      setReferenceVideoFile({ name: file.name, storagePath });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao enviar o vídeo");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleProductPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    // `multiple` no input já entrega todos os arquivos marcados no seletor
    // do dispositivo numa única abertura — FileList pode ter 1 ou várias
    // entradas, o resto do fluxo (soma à lista, 1 chamada de análise) é o
    // mesmo de antes, só processando o lote inteiro de uma vez em vez de
    // 1 arquivo por vez.
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const newDataUrls = await Promise.all(files.map(readFileAsDataUrl));
    // Soma à lista em vez de substituir — várias fotos do mesmo produto
    // (frente, verso, rótulo) analisadas juntas numa chamada só.
    const nextPhotos = [...productPhotoDataUrls, ...newDataUrls];
    setProductPhotoDataUrls(nextPhotos);
    setAnalyzingProductPhoto(true);
    try {
      const { visualDescription } = await analyzeProductPhotoFn({ data: { imageDataUrls: nextPhotos } });
      setProductPhotoDescription(visualDescription);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao analisar a foto do produto");
    } finally {
      setAnalyzingProductPhoto(false);
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setStep("loading");
    setErrorMessage(null);

    const hasActor = actorName.trim() && actorVoice.trim() && actorAppearance.trim();

    const productInfo: ContentRequest["productInfo"] = [];
    if (productInfoText.trim()) {
      productInfo.push({ text: productInfoText.trim(), kind: "fato", source: "campo de informações" });
    }
    if (productPhotoDescription) {
      productInfo.push({ text: productPhotoDescription, kind: "inferencia", source: "foto do produto" });
    }

    const request: ContentRequest = {
      project,
      objective,
      mode,
      productPhotoUrls: productPhotoDataUrls,
      productInfo,
      referenceVideoUrl: null,
      referenceVideoStoragePath: referenceVideoFile?.storagePath ?? null,
      actorProfile: hasActor
        ? {
            name: actorName.trim(),
            voiceDescription: actorVoice.trim(),
            appearanceDescription: actorAppearance.trim(),
          }
        : null,
      targetDurationSeconds,
    };

    try {
      // Caminho A (com vídeo de referência): a Ingestão (download + ffmpeg +
      // Whisper + visão) é lenta demais pra caber numa function só — mesmo
      // separada do resto do pipeline, um vídeo real ainda estourava os 60s
      // do Vercel (confirmado em produção). Agora é um job em 3 steps
      // (download+frames, transcript, visão+classificação+recomendação)
      // processado pelo próprio polling do cliente: cada chamada de
      // `advanceIngestionJob` roda só UM step (cabe nos 60s) e devolve o
      // job atualizado, até "succeeded"/"failed". Caminho B não tem nada
      // lento pra enfileirar.
      // Oportunidade escolhida na aba Oportunidades: classificação/
      // recomendação já vêm sintetizadas do bridge (sem custo de
      // servidor), então nem a Ingestão nem re-análise rodam de novo.
      const precomputedAnalysis = request.referenceVideoStoragePath
        ? await runIngestionJob(request)
        : (opportunityAnalysis ?? undefined);
      if (opportunityAnalysis) setOpportunityAnalysis(null); // consumido — não reaproveitar numa próxima geração manual
      const res = await runContentGenerationJob(request, precomputedAnalysis);
      setResult(res);
      setStep(res.status === "aprovado" ? "resultado" : "manual");
      try {
        // Nunca persiste a foto (base64, MBs) no Histórico — ela já cumpriu
        // seu papel (virou claim via visão) antes de chegar aqui; guardar o
        // blob de novo em toda geração só infla o banco sem necessidade.
        const outputForHistory: PipelineOutput = {
          ...res.output,
          request: { ...res.output.request, productPhotoUrls: [] },
        };
        await addHistoryEntryRpc({
          data: {
            project: res.output.request.project,
            format: res.output.recommendation.format,
            theme: productInfoText.trim(),
            selectedHook: res.output.generation.selectedHook,
            output: outputForHistory,
          },
        });
      } catch {
        // best-effort — não salvar histórico não deve travar o fluxo principal
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  }

  function reset() {
    setStep("form");
    setResult(null);
    setErrorMessage(null);
  }

  function updateSegmentVideoPrompt(segmentIndex: number, videoPrompt: string) {
    setResult((prev) => {
      if (!prev) return prev;
      const flowSegments = prev.output.generation.flowSegments.map((s) =>
        s.index === segmentIndex ? { ...s, videoPrompt } : s,
      );
      return { ...prev, output: { ...prev.output, generation: { ...prev.output.generation, flowSegments } } };
    });
  }

  function updateGeneration(generation: PipelineOutput["generation"]) {
    setResult((prev) => (prev ? { ...prev, output: { ...prev.output, generation } } : prev));
  }

  if (step === "loading") {
    return (
      <div className="app">
        <BrandRow />
        <StageIndicator current={1} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 60 }}>
          <div className="spinner" />
          <div className="h1-sub">
            {ingestionStep
              ? (INGESTION_STEP_LABELS[ingestionStep] ?? CONTENT_GENERATION_STEP_LABELS[ingestionStep] ?? "Processando...")
              : "Analisando produto, recomendando formato e gerando roteiro..."}
            {ingestionStep && ingestionProgressPercent != null ? ` — ${ingestionProgressPercent}%` : ""}
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="app">
        <BrandRow onBack={reset} />
        <div className="reject-card">
          <div className="h1-sub">Algo deu errado: {errorMessage}</div>
        </div>
        <button className="btn-primary" onClick={reset}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (step === "resultado" && result) {
    return (
      <ResultadoView
        output={result.output}
        onContinue={() => setStep("roteiro")}
        onBack={reset}
        onReset={reset}
      />
    );
  }

  if (step === "roteiro" && result) {
    return (
      <RoteiroView
        output={result.output}
        approved={result.status === "aprovado"}
        onBack={() => setStep("resultado")}
        onReset={reset}
        onSegmentVideoPromptChange={updateSegmentVideoPrompt}
        onGenerationUpdate={updateGeneration}
      />
    );
  }

  if (step === "manual" && result) {
    return <ManualView output={result.output} onBack={reset} onReset={reset} />;
  }

  return (
    <div className="app">
      <BrandRow onProfile={onOpenProfile} />
      <StageIndicator current={0} />
      <div>
        <h1 className="h1">Criar</h1>
        <div className="h1-sub">Envie seu produto e defina o objetivo.</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="pill-row">
          <button
            type="button"
            className={`pill ${project === "comercial" ? "active" : ""}`}
            onClick={() => setProject("comercial")}
          >
            Comercial
          </button>
          <button
            type="button"
            className={`pill ${project === "jeova_fala" ? "active" : ""}`}
            onClick={() => setProject("jeova_fala")}
          >
            Jeová Fala
          </button>
        </div>

        <div>
          <div className="section-label">Produto</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                flex: 1,
                height: 130,
                borderRadius: 14,
                overflow: "hidden",
                background: "#131313",
                border: "1px solid #262626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8A8A8A",
                fontSize: 12,
                position: "relative",
              }}
            >
              {productPhotoDataUrls.length > 0 ? (
                <>
                  <img
                    src={productPhotoDataUrls[productPhotoDataUrls.length - 1]}
                    alt="Produto"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {productPhotoDataUrls.length > 1 && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 6,
                        right: 6,
                        background: "rgba(0,0,0,0.7)",
                        color: "#fff",
                        borderRadius: 999,
                        fontSize: 11,
                        padding: "2px 7px",
                      }}
                    >
                      {productPhotoDataUrls.length} fotos
                    </span>
                  )}
                </>
              ) : (
                "Foto do produto"
              )}
            </div>
            <label
              style={{
                flex: 1,
                height: 130,
                borderRadius: 14,
                border: "1.5px dashed #2E2E2E",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#8A8A8A",
                cursor: "pointer",
              }}
            >
              <IconAddPhoto />
              <span style={{ fontSize: 12, textAlign: "center", lineHeight: 1.3 }}>
                {analyzingProductPhoto ? (
                  "Analisando..."
                ) : (
                  <>
                    Adicionar foto
                    <br />
                    do produto
                  </>
                )}
              </span>
              <input type="file" accept="image/*" multiple onChange={handleProductPhoto} style={{ display: "none" }} />
            </label>
          </div>
          {productPhotoDescription && (
            <div className="hint">
              Das fotos: {productPhotoDescription}
              {productPhotoDataUrls.length > 0 && (
                <>
                  {" — "}
                  <button
                    type="button"
                    onClick={() => {
                      setProductPhotoDataUrls([]);
                      setProductPhotoDescription(null);
                    }}
                    style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}
                  >
                    limpar
                  </button>
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className="section-label">{project === "jeova_fala" ? "Tema" : "Informações do produto"}</div>
            <textarea
              className="field-textarea"
              placeholder={
                project === "jeova_fala"
                  ? "Tema — ex: mensagem de deus pra você hoje forte, salmo 27, medo e confiança..."
                  : "Nome, material, benefícios conhecidos..."
              }
              value={productInfoText}
              onChange={(e) => setProductInfoText(e.target.value)}
            />
            {project === "jeova_fala" ? (
              <div className="hint">
                Dica: no app do TikTok, em "Informações de pesquisas para criadores", tem assuntos reais
                em alta (com % de crescimento de verdade) — cole um aqui em vez de inventar um tema do zero.
              </div>
            ) : (
              <div className="hint">Usado apenas o que você informar aqui — nada é inventado sobre o produto.</div>
            )}
            <SavedThemesDrawer
              savedThemes={savedThemes}
              currentText={productInfoText}
              onSave={saveCurrentTheme}
              onPick={setProductInfoText}
              onRemove={removeSavedTheme}
            />
          </div>
        </div>

        <div>
          <div className="section-label">Objetivo</div>
          <div className="pill-row">
            {(["vender", "engajar", "educar", "outros"] as const).map((o) => (
              <button
                key={o}
                type="button"
                className={`pill ${objective === o ? "active" : ""}`}
                onClick={() => setObjective(o)}
              >
                {o[0].toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label">Modo</div>
          <div className="pill-row">
            <button
              type="button"
              className={`pill ${mode === "tiktok_shop" ? "active" : ""}`}
              onClick={() => setMode("tiktok_shop")}
            >
              TikTok Shop
            </button>
            <button
              type="button"
              className={`pill ${mode === "organico" ? "active" : ""}`}
              onClick={() => setMode("organico")}
            >
              Orgânico
            </button>
          </div>
        </div>

        <div>
          <div className="section-label">Vídeo de referência (opcional)</div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#101010",
              border: "1.5px dashed #2A2A2A",
              borderRadius: 14,
              padding: 14,
              cursor: uploadingVideo ? "default" : "pointer",
            }}
          >
            <span
              style={{
                flex: "0 0 38px",
                width: 38,
                height: 38,
                borderRadius: 999,
                background: "#1C1C1C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9A9A9A",
              }}
            >
              <IconPlay />
            </span>
            <span style={{ flex: 1, color: "#B5B5B5", fontSize: 13.5 }}>
              {uploadingVideo
                ? "Enviando vídeo..."
                : referenceVideoFile
                  ? referenceVideoFile.name
                  : "Enviar vídeo (ex: gravação de tela)"}
            </span>
            {referenceVideoFile ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setReferenceVideoFile(null);
                }}
                style={{ background: "none", border: "none", color: "#6B6B6B", flex: "0 0 auto", cursor: "pointer" }}
              >
                remover
              </button>
            ) : (
              <input
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                disabled={uploadingVideo}
                onChange={handleReferenceVideoFile}
              />
            )}
          </label>
          <div className="hint">
            A primeira geração com vídeo de referência pode demorar alguns segundos a mais —
            as ferramentas de extração são baixadas na primeira vez.
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "▾" : "▸"} Mais opções (duração, ator principal)
        </button>

        {showMore && (
          <div className="step-enter" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="section-label">Duração (blocos de 10s no Flow)</div>
              <div className="pill-row">
                <button
                  type="button"
                  className={`pill ${targetDurationSeconds === null ? "active" : ""}`}
                  onClick={() => setTargetDurationSeconds(null)}
                >
                  Automático
                </button>
                {[10, 20, 30, 40, 50, 60].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    className={`pill ${targetDurationSeconds === seconds ? "active" : ""}`}
                    onClick={() => setTargetDurationSeconds(seconds)}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <div className="hint">
                Cada 10s vira uma submissão separada no Flow — 50s = 5 blocos de prompt pra colar um por vez.
              </div>
            </div>

            <div>
              <div className="section-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Ator principal</span>
                <span style={{ fontWeight: 500, color: "#7A7A7A" }}>Opcional</span>
              </div>

              {ACTOR_PRESETS.length > 0 && (
                <div className="pill-row" style={{ marginBottom: 8 }}>
                  {ACTOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="pill"
                      onClick={() => {
                        setActorName(preset.name);
                        setActorVoice(preset.voiceDescription);
                        setActorAppearance(preset.appearanceDescription);
                      }}
                    >
                      Usar preset: {preset.name}
                    </button>
                  ))}
                </div>
              )}

              <input
                className="field-input"
                placeholder="Nome (ex: Jesus)"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <input
                className="field-input"
                placeholder="Voz (ex: grave, calma, tom acolhedor)"
                value={actorVoice}
                onChange={(e) => setActorVoice(e.target.value)}
                style={{ marginBottom: 8 }}
              />

              <label
                className="btn-secondary"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 8, cursor: "pointer" }}
              >
                <IconCamera />
                {analyzingPhoto ? "Analisando foto..." : "Enviar foto de referência (opcional)"}
                <input type="file" accept="image/*" onChange={handleActorPhoto} disabled={analyzingPhoto} style={{ display: "none" }} />
              </label>

              <textarea
                className="field-textarea"
                placeholder="Aparência (ex: túnica branca, cabelo castanho, barba) — ou envie uma foto acima que a IA descreve pra você"
                value={actorAppearance}
                onChange={(e) => setActorAppearance(e.target.value)}
                style={{ minHeight: 50 }}
              />
              <div className="hint">
                Enviando foto, a aparência é extraída da imagem real (não inventada) e travada em todas as
                cenas junto com a voz. Preenchendo os 3 campos, o Cinematográfico mantém essas características
                sem variar de cena pra cena.
              </div>
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary">
          Analisar
          <IconArrowRight />
        </button>
      </form>
    </div>
  );
}

function ResultadoView({
  output,
  onContinue,
  onBack,
  onReset,
}: {
  output: PipelineOutput;
  onContinue: () => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const { recommendation, generation } = output;
  return (
    <div className="app">
      <BrandRow onBack={onBack} />
      <h1 className="h1" style={{ fontSize: 26, marginBottom: 20 }}>
        Resultado da análise
      </h1>

      <div className="rec-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="rec-eyebrow" style={{ margin: 0 }}>
            Formato recomendado
          </span>
          <span className="conf-badge">
            {/* recommendation.confidence é heurística categórica, nunca um número — não inventa "91%" */}
            Confiança {CONFIDENCE_LABEL[recommendation.confidence]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              flexShrink: 0,
              background: "#131313",
              border: "1px solid #262626",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8A8A8A",
              fontSize: 11,
            }}
          >
            {output.request.productPhotoUrls[0] ? (
              <img
                src={output.request.productPhotoUrls[0]}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              "Foto"
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconStar />
            <span className="rec-name">{formatLabel(recommendation.format)}</span>
          </div>
        </div>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Por quê?</div>
        <div style={{ color: "#9A9A9A", fontSize: 13, lineHeight: 1.4 }}>{recommendation.reasoning}</div>
      </div>

      <div>
        <div className="section-label">Outras opções</div>
        <div className="pill-row">
          {recommendation.alternatives.map((f) => (
            <span key={f} className="pill" style={{ fontWeight: 600 }}>
              {formatLabel(f)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label">Hooks sugeridos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {generation.hooks.map((h, i) => (
            <div key={i} className="hook-card">
              <div className="hook-num">{i + 1}</div>
              <div style={{ flex: 1, color: "#E0E0E0", fontSize: 13.5, lineHeight: 1.4 }}>{h}</div>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(h)}
                style={{ background: "none", border: "none", color: "#6B6B6B", cursor: "pointer", flexShrink: 0, display: "flex" }}
                aria-label="Copiar hook"
              >
                <IconCopy />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={onContinue}>
        Gerar roteiro
        <IconArrowRight />
      </button>
      <button className="btn-secondary" onClick={onReset}>
        Começar de novo
      </button>
    </div>
  );
}

function FlowSegmentCard({
  segment,
  scenes,
  actorProfile,
  onVideoPromptChange,
}: {
  segment: PipelineOutput["generation"]["flowSegments"][number];
  scenes: PipelineOutput["generation"]["scenes"];
  actorProfile: ContentRequest["actorProfile"];
  onVideoPromptChange: (segmentIndex: number, videoPrompt: string) => void;
}) {
  const refineSceneFn = useServerFn(refineScene);
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const coveredScenes = scenes.filter((s) => segment.sceneIndexes.includes(s.index));

  async function handleRefine() {
    if (!feedback.trim()) return;
    setRefining(true);
    try {
      const { videoPrompt } = await refineSceneFn({
        data: { segment, scenes, actorProfile, feedback: feedback.trim() },
      });
      onVideoPromptChange(segment.index, videoPrompt);
      setFeedback("");
      setShowFeedback(false);
    } catch {
      // best-effort — o usuário vê o prompt antigo ainda lá, pode tentar de novo
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className="card">
      <button
        type="button"
        className="card-copy-btn"
        onClick={() => navigator.clipboard?.writeText(segment.videoPrompt)}
        aria-label="Copiar prompt deste bloco"
      >
        <IconCopy />
      </button>
      <div className="scene-tag" style={{ paddingRight: 24 }}>
        BLOCO {segment.index + 1} — {segment.startSeconds}s–{segment.endSeconds}s (10s no Flow)
      </div>
      {coveredScenes.map((s) => (
        <div key={s.index} style={{ fontSize: 13.5, marginBottom: 4 }}>
          <span style={{ color: "#9A9A9A" }}>[{s.role}]</span> {s.narration}
          {s.onScreenText && (
            <span style={{ color: "#B5B5B5" }}> · Texto na tela: {s.onScreenText}</span>
          )}
        </div>
      ))}
      <div
        style={{
          fontSize: 13.5,
          background: "#070707",
          border: "1px solid #252525",
          borderRadius: 10,
          padding: 10,
          marginTop: 6,
          marginBottom: 8,
        }}
      >
        {segment.videoPrompt}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn-secondary"
          style={{ padding: "8px 12px", fontSize: 13.5 }}
          onClick={() => navigator.clipboard?.writeText(segment.videoPrompt)}
        >
          Copiar prompt deste bloco
        </button>
        <button
          className="btn-secondary"
          style={{ padding: "8px 12px", fontSize: 13.5 }}
          onClick={() => setShowFeedback((v) => !v)}
        >
          Não ficou bom no Flow?
        </button>
      </div>
      {showFeedback && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            className="input"
            rows={2}
            placeholder='Ex: "a boca não sincronizou", "troca a palavra X", "câmera muito parada"'
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button className="btn-primary" style={{ fontSize: 13.5, padding: "8px 12px" }} onClick={handleRefine} disabled={refining}>
            {refining ? "Ajustando..." : "Ajustar só este bloco"}
          </button>
        </div>
      )}
    </div>
  );
}

function SeoSection({ output, onSeoResult }: { output: PipelineOutput; onSeoResult: (generation: GenerationResult) => void }) {
  const generateSeoPackageFn = useServerFn(generateSeoPackage);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<PipelineOutput["compliance"]["violations"]>([]);
  const { generation } = output;

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateSeoPackageFn({ data: { generation, request: output.request } });
      onSeoResult(result.generation);
      setWarnings(result.warnings);
    } catch {
      // best-effort — usuário pode tentar de novo
    } finally {
      setLoading(false);
    }
  }

  if (!generation.caption) {
    return (
      <div>
        <div className="section-label">Legenda</div>
        <div className="card">
          <div style={{ fontSize: 14, color: "#B5B5B5", marginBottom: 10 }}>
            Gerada só quando você pedir — sem hashtag (sem dado real de TikTok por trás pra confiar).
          </div>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Gerando..." : "Gerar legenda"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-label">Legenda</div>
      <div className="card">
        <div style={{ fontSize: 14.5, marginBottom: 8 }}>{generation.caption}</div>
        {warnings.length > 0 && (
          <div className="reject-card" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Checagem automática encontrou possível problema:</div>
            {warnings.map((w, i) => (
              <div key={i} className="violation-item">
                <div>"{w.flaggedText}"</div>
                <div style={{ color: "#9A9A9A" }}>{w.reason}</div>
              </div>
            ))}
          </div>
        )}
        <button
          className="btn-secondary"
          style={{ padding: "8px 12px", fontSize: 13.5 }}
          onClick={() => navigator.clipboard?.writeText(generation.caption)}
        >
          Copiar legenda
        </button>
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  hook: "Gancho",
  problema: "Apresentação do problema",
  agitacao: "Agitação",
  solucao: "Demonstração prática",
  cta: "Chamada para ação",
};

function RoteiroView({
  output,
  approved,
  onBack,
  onReset,
  onSegmentVideoPromptChange,
  onGenerationUpdate,
}: {
  output: PipelineOutput;
  approved: boolean;
  onBack: () => void;
  onReset: () => void;
  onSegmentVideoPromptChange: (segmentIndex: number, videoPrompt: string) => void;
  onGenerationUpdate: (generation: GenerationResult) => void;
}) {
  const { generation, compliance } = output;
  const productPhoto = output.request.productPhotoUrls[0] ?? null;

  return (
    <div className="app">
      <BrandRow onBack={onBack} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ color: "#fff", fontSize: 24, fontWeight: 800 }}>
          {approved ? "Roteiro aprovado" : "Roteiro (compliance pendente)"}
        </span>
        {approved && <IconApprovedBadge />}
      </div>

      <div>
        <div className="section-label">Hook selecionado</div>
        <div className="card">
          <div style={{ color: "#E5E5E5", fontSize: 14, lineHeight: 1.5, paddingRight: 24 }}>
            "{generation.selectedHook}"
          </div>
          <button
            type="button"
            className="card-copy-btn"
            onClick={() => navigator.clipboard?.writeText(generation.selectedHook)}
            aria-label="Copiar hook"
          >
            <IconCopy />
          </button>
        </div>
      </div>

      <div>
        <div className="section-label">Roteiro</div>
        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", paddingRight: 24 }}>
            {generation.scenes.map((s, i) => (
              <div key={s.index} style={{ color: "#D5D5D5", fontSize: 13.5, lineHeight: 1.7 }}>
                Cena {i + 1} – {ROLE_LABEL[s.role] ?? s.role}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="card-copy-btn"
            onClick={() =>
              navigator.clipboard?.writeText(
                generation.scenes.map((s, i) => `Cena ${i + 1} – ${ROLE_LABEL[s.role] ?? s.role}`).join("\n"),
              )
            }
            aria-label="Copiar roteiro"
          >
            <IconCopy />
          </button>
        </div>
      </div>

      <div>
        <div className="section-label">Cenas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {generation.scenes.map((s, i) => (
            <div key={s.index} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  flexShrink: 0,
                  overflow: "hidden",
                  background: "#131313",
                  border: "1px solid #262626",
                }}
              >
                {productPhoto && (
                  <img src={productPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
                  Cena {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ color: "#9A9A9A", fontSize: 12, lineHeight: 1.5 }}>
                  Câmera: {s.camera}
                  <br />
                  Ação: {s.action}
                  <br />
                  Duração: {Math.round(s.endSeconds - s.startSeconds)}s
                </div>
              </div>
              <button
                type="button"
                className="card-copy-btn"
                style={{ position: "static" }}
                onClick={() =>
                  navigator.clipboard?.writeText(`Câmera: ${s.camera}\nAção: ${s.action}\nDuração: ${Math.round(s.endSeconds - s.startSeconds)}s`)
                }
                aria-label="Copiar cena"
              >
                <IconCopy />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label">Prompt de vídeo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {generation.flowSegments.map((segment) => (
            <FlowSegmentCard
              key={segment.index}
              segment={segment}
              scenes={generation.scenes}
              actorProfile={output.request.actorProfile}
              onVideoPromptChange={onSegmentVideoPromptChange}
            />
          ))}
        </div>
      </div>

      <SeoSection output={output} onSeoResult={onGenerationUpdate} />

      {approved ? (
        <div className="approve-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <IconShieldCheck />
            <span style={{ color: "#22C55E", fontSize: 14, fontWeight: 700 }}>Compliance aprovado</span>
          </div>
          {compliance.checkedGroups.map((group) => (
            <div key={group} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <IconCheckCircleSmall />
              <span style={{ color: "#BFEBD1", fontSize: 13 }}>{group}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="reject-card">
          <div style={{ fontWeight: 700, fontSize: 15 }}>Correção necessária</div>
          {compliance.violations.map((v, i) => (
            <div key={i} className="violation-item">
              <div style={{ fontWeight: 700 }}>{v.group}</div>
              <div>"{v.flaggedText}"</div>
              <div style={{ color: "#9A9A9A" }}>{v.reason}</div>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button
          className="btn-secondary"
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(generation, null, 2))}
        >
          <IconCopy />
          Copiar
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1.4 }}
          onClick={() =>
            navigator.clipboard?.writeText(
              generation.flowSegments.map((s) => `Bloco ${s.index + 1} (${s.startSeconds}s-${s.endSeconds}s):\n${s.videoPrompt}`).join("\n\n"),
            )
          }
        >
          <IconPlay />
          Gerar vídeo
        </button>
      </div>
      <button className="btn-secondary" onClick={onReset}>
        Começar de novo
      </button>
    </div>
  );
}

function ManualView({
  output,
  onBack,
  onReset,
}: {
  output: PipelineOutput;
  onBack: () => void;
  onReset: () => void;
}) {
  return (
    <div className="app">
      <BrandRow onBack={onBack} />
      <h1 className="h1" style={{ fontSize: 20 }}>
        Correção necessária
      </h1>
      <div className="h1-sub">
        O compliance reprovou depois de {output.compliance.attempt} tentativas automáticas. Revise manualmente antes
        de gerar o vídeo.
      </div>
      <div className="reject-card">
        {output.compliance.violations.map((v, i) => (
          <div key={i} className="violation-item">
            <div style={{ fontWeight: 700 }}>{v.group}</div>
            <div>"{v.flaggedText}"</div>
            <div style={{ color: "#9A9A9A" }}>{v.reason}</div>
            <div style={{ color: "#FF6A1A", marginTop: 4 }}>Sugestão: {v.suggestion}</div>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={onReset}>
        Começar de novo
      </button>
    </div>
  );
}

function formatLabel(format: string): string {
  return format
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
