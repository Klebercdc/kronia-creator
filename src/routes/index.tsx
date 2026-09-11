import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, type FormEvent } from "react";
import {
  runContentPipeline,
  analyzeActorPhoto,
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
import type { SavedTheme, HistoryEntry } from "../lib/supabase";
import type { ContentRequest, GenerationResult, PipelineOutput } from "../types/pipeline";
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

function BrandRow() {
  return (
    <div className="brand-row">
      <img src={logoIcon} alt="" style={{ height: 34, width: "auto" }} />
      <div>
        <div className="brand-word">KRONIA</div>
        <div className="brand-sub">Criador Inteligente</div>
      </div>
    </div>
  );
}

const STAGES = ["Criar", "Analisar", "Resultado"] as const;

function StageIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {STAGES.map((label, i) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12.5,
              fontWeight: 700,
              color: i <= current ? "oklch(0.85 0.15 45)" : "oklch(0.48 0.015 285)",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                background: i <= current ? "oklch(0.68 0.19 45)" : "oklch(0.24 0.018 285)",
                color: i <= current ? "#fff" : "oklch(0.55 0.02 285)",
              }}
            >
              {i + 1}
            </span>
            {label}
          </span>
          {i < STAGES.length - 1 && <span style={{ color: "oklch(0.35 0.015 285)" }}>—</span>}
        </span>
      ))}
    </div>
  );
}

type AppTab = "criar" | "historico" | "explorar" | "perfil";

const TAB_ITEMS: { id: AppTab; label: string; icon: string }[] = [
  { id: "criar", label: "Criar", icon: "＋" },
  { id: "historico", label: "Histórico", icon: "🕐" },
  { id: "explorar", label: "Explorar", icon: "⦿" },
  { id: "perfil", label: "Perfil", icon: "☺" },
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
          <span className="bottom-nav-icon">{item.icon}</span>
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
      <div className="card" style={{ color: "oklch(0.6 0.02 285)", fontSize: 14 }}>
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
            border: "1px solid oklch(0.24 0.018 285)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {savedThemes.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "oklch(0.6 0.02 285)" }}>Nada salvo ainda.</div>
          ) : (
            savedThemes.map((theme) => (
              <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, textAlign: "left", padding: "6px 10px", fontSize: 13.5 }}
                  onClick={() => onPick(theme.text)}
                >
                  {theme.text}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(theme.id)}
                  style={{ background: "none", border: "none", color: "oklch(0.6 0.02 285)", cursor: "pointer", fontSize: 16, padding: "0 6px" }}
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
        <div className="card" style={{ color: "oklch(0.6 0.02 285)", fontSize: 14 }}>
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
                <div style={{ fontSize: 13.5, color: "oklch(0.7 0.02 285)" }}>
                  {entry.theme || "(sem tema)"} · {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(entry.id)}
                style={{ background: "none", border: "none", color: "oklch(0.6 0.02 285)", cursor: "pointer", fontSize: 16 }}
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
                      background: "oklch(0.13 0.012 285)",
                      border: "1px solid oklch(0.24 0.018 285)",
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

function CriadorApp() {
  const [tab, setTab] = useState<AppTab>("criar");
  return (
    <>
      {tab === "criar" && <CriarFlow />}
      {tab === "historico" && <HistoricoTab />}
      {tab === "explorar" && (
        <PlaceholderTab
          title="Explorar"
          hint="Em breve: temas em alta e exemplos de outros criadores direto no app."
        />
      )}
      {tab === "perfil" && (
        <PlaceholderTab title="Perfil" hint="Em breve: atores salvos, preferências e configurações da conta." />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}

function CriarFlow() {
  const runPipelineFn = useServerFn(runContentPipeline);
  const analyzeActorPhotoFn = useServerFn(analyzeActorPhoto);
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
  const [productPhotoDataUrl, setProductPhotoDataUrl] = useState<string | null>(null);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState<number | null>(null);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [actorName, setActorName] = useState("");
  const [actorVoice, setActorVoice] = useState("");
  const [actorAppearance, setActorAppearance] = useState("");
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    listSavedThemesRpc()
      .then(setSavedThemes)
      .catch(() => {
        // best-effort — sem tema salvo carregado não quebra o resto do app
      });
  }, []);

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

  async function handleProductPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setProductPhotoDataUrl(dataUrl);
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setStep("loading");
    setErrorMessage(null);

    const hasActor = actorName.trim() && actorVoice.trim() && actorAppearance.trim();

    const request: ContentRequest = {
      project,
      objective,
      mode,
      productPhotoUrl: productPhotoDataUrl,
      productInfo: productInfoText.trim()
        ? [{ text: productInfoText.trim(), kind: "fato", source: "campo de informações" }]
        : [],
      referenceVideoUrl: referenceVideoUrl.trim() || null,
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
      const res = await runPipelineFn({ data: request });
      setResult(res);
      setStep(res.status === "aprovado" ? "resultado" : "manual");
      try {
        await addHistoryEntryRpc({
          data: {
            project: res.output.request.project,
            format: res.output.recommendation.format,
            theme: productInfoText.trim(),
            selectedHook: res.output.generation.selectedHook,
            output: res.output,
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
          <div className="h1-sub">Analisando produto, recomendando formato e gerando roteiro...</div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="app">
        <BrandRow />
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
    return <ResultadoView output={result.output} onContinue={() => setStep("roteiro")} onReset={reset} />;
  }

  if (step === "roteiro" && result) {
    return (
      <RoteiroView
        output={result.output}
        approved={result.status === "aprovado"}
        onReset={reset}
        onSegmentVideoPromptChange={updateSegmentVideoPrompt}
        onGenerationUpdate={updateGeneration}
      />
    );
  }

  if (step === "manual" && result) {
    return <ManualView output={result.output} onReset={reset} />;
  }

  return (
    <div className="app">
      <BrandRow />
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
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            {productPhotoDataUrl ? (
              <img
                src={productPhotoDataUrl}
                alt="Produto"
                style={{ width: 84, height: 84, borderRadius: 14, objectFit: "cover", border: "1px solid oklch(0.28 0.02 285)" }}
              />
            ) : null}
            <label
              className="btn-secondary"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 84,
                height: 84,
                borderRadius: 14,
                borderStyle: "dashed",
                cursor: "pointer",
                fontSize: 12,
                textAlign: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 20 }}>+</span>
              {productPhotoDataUrl ? "Trocar foto" : "Adicionar foto"}
              <input type="file" accept="image/*" onChange={handleProductPhoto} style={{ display: "none" }} />
            </label>
          </div>
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
              Dica: no app do TikTok, em "Informações de pesquisas para criadores", tem assuntos reais em
              alta (com % de crescimento de verdade) — cole um aqui em vez de inventar um tema do zero.
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
          <div className="section-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Vídeo de referência</span>
            <span style={{ fontWeight: 500, color: "oklch(0.5 0.02 285)" }}>Opcional</span>
          </div>
          <input
            className="field-input"
            placeholder="Link do vídeo (TikTok, YouTube...)"
            value={referenceVideoUrl}
            onChange={(e) => setReferenceVideoUrl(e.target.value)}
          />
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
                <span style={{ fontWeight: 500, color: "oklch(0.5 0.02 285)" }}>Opcional</span>
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

              <label className="btn-secondary" style={{ display: "block", textAlign: "center", marginBottom: 8, cursor: "pointer" }}>
                {analyzingPhoto ? "Analisando foto..." : "📷 Enviar foto de referência (opcional)"}
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
          Analisar →
        </button>
      </form>
    </div>
  );
}

function ResultadoView({
  output,
  onContinue,
  onReset,
}: {
  output: PipelineOutput;
  onContinue: () => void;
  onReset: () => void;
}) {
  const { recommendation, generation } = output;
  return (
    <div className="app">
      <BrandRow />
      <StageIndicator current={2} />
      <h1 className="h1" style={{ fontSize: 20 }}>
        Resultado da análise
      </h1>

      <div className="rec-card">
        <div className="rec-eyebrow">FORMATO RECOMENDADO</div>
        <div className="rec-head">
          <div className="rec-name">{formatLabel(recommendation.format)}</div>
          <div className="conf-badge">
            <div className="conf-label">CONFIANÇA</div>
            <div className="conf-val">{CONFIDENCE_LABEL[recommendation.confidence]}</div>
          </div>
        </div>
        <div className="h1-sub" style={{ marginTop: 10 }}>
          {recommendation.reasoning}
        </div>
      </div>

      <div>
        <div className="section-label">Outras opções</div>
        <div className="pill-row">
          {recommendation.alternatives.map((f) => (
            <span key={f} className="pill">
              {formatLabel(f)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label">Hooks sugeridos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {generation.hooks.map((h, i) => (
            <div key={i} className="hook-card">
              <div className="hook-num">{i + 1}</div>
              <div style={{ fontSize: 14 }}>{h}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={onContinue}>
        Gerar roteiro →
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
      <div className="scene-tag">
        BLOCO {segment.index + 1} — {segment.startSeconds}s–{segment.endSeconds}s (10s no Flow)
      </div>
      {coveredScenes.map((s) => (
        <div key={s.index} style={{ fontSize: 13.5, marginBottom: 4 }}>
          <span style={{ color: "oklch(0.65 0.02 285)" }}>[{s.role}]</span> {s.narration}
          {s.onScreenText && (
            <span style={{ color: "oklch(0.7 0.02 285)" }}> · Texto na tela: {s.onScreenText}</span>
          )}
        </div>
      ))}
      <div
        style={{
          fontSize: 13.5,
          background: "oklch(0.13 0.012 285)",
          border: "1px solid oklch(0.24 0.018 285)",
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
          <div style={{ fontSize: 14, color: "oklch(0.7 0.02 285)", marginBottom: 10 }}>
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
                <div style={{ color: "oklch(0.65 0.02 285)" }}>{w.reason}</div>
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

function RoteiroView({
  output,
  approved,
  onReset,
  onSegmentVideoPromptChange,
  onGenerationUpdate,
}: {
  output: PipelineOutput;
  approved: boolean;
  onReset: () => void;
  onSegmentVideoPromptChange: (segmentIndex: number, videoPrompt: string) => void;
  onGenerationUpdate: (generation: GenerationResult) => void;
}) {
  const { generation, compliance } = output;

  return (
    <div className="app">
      <BrandRow />
      <StageIndicator current={2} />
      <h1 className="h1" style={{ fontSize: 20 }}>
        {approved ? "Roteiro aprovado ✓" : "Roteiro (compliance pendente)"}
      </h1>

      <div>
        <div className="section-label">Hook selecionado</div>
        <div className="card" style={{ fontStyle: "italic", fontSize: 15 }}>
          "{generation.selectedHook}"
        </div>
      </div>

      <div>
        <div className="section-label">Blocos de 10s — prompts prontos pro Flow</div>
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
          <div style={{ fontWeight: 700, fontSize: 15 }}>Compliance aprovado</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{compliance.checkedGroups.length} grupos de regra verificados.</div>
        </div>
      ) : (
        <div className="reject-card">
          <div style={{ fontWeight: 700, fontSize: 15 }}>Correção necessária</div>
          {compliance.violations.map((v, i) => (
            <div key={i} className="violation-item">
              <div style={{ fontWeight: 700 }}>{v.group}</div>
              <div>"{v.flaggedText}"</div>
              <div style={{ color: "oklch(0.65 0.02 285)" }}>{v.reason}</div>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button
          className="btn-secondary"
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(generation, null, 2))}
        >
          Copiar roteiro
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
          Copiar todos os prompts
        </button>
      </div>
      <button className="btn-secondary" onClick={onReset}>
        Começar de novo
      </button>
    </div>
  );
}

function ManualView({ output, onReset }: { output: PipelineOutput; onReset: () => void }) {
  return (
    <div className="app">
      <BrandRow />
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
            <div style={{ color: "oklch(0.65 0.02 285)" }}>{v.reason}</div>
            <div style={{ color: "oklch(0.75 0.15 45)", marginTop: 4 }}>Sugestão: {v.suggestion}</div>
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
