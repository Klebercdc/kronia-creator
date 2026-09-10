import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  runContentPipeline,
  analyzeActorPhoto,
  refineScene,
  generateSeoPackage,
  type RunPipelineResult,
} from "../server/pipeline.functions";
import { ACTOR_PRESETS } from "../core/generation/actor-presets";
import type { ContentRequest, GenerationResult, PipelineOutput } from "../types/pipeline";

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
      <svg className="brand-mark" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff9a3c" />
            <stop offset="1" stopColor="#2dd4a7" />
          </linearGradient>
        </defs>
        <path d="M5.4 2.5v19" stroke="oklch(0.9 0.004 285)" strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <path d="M18 2.5L7.8 12" stroke="url(#kg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M9.6 12L19 21.5" stroke="url(#kg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
      <div>
        <div className="brand-word">KRONIA</div>
        <div className="brand-sub">Criador Inteligente</div>
      </div>
    </div>
  );
}

function CriadorApp() {
  const runPipelineFn = useServerFn(runContentPipeline);
  const analyzeActorPhotoFn = useServerFn(analyzeActorPhoto);

  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<RunPipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [project, setProject] = useState<ContentRequest["project"]>("comercial");
  const [objective, setObjective] = useState<ContentRequest["objective"]>("vender");
  const [mode, setMode] = useState<ContentRequest["mode"]>("tiktok_shop");
  const [productInfoText, setProductInfoText] = useState("");
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [actorName, setActorName] = useState("");
  const [actorVoice, setActorVoice] = useState("");
  const [actorAppearance, setActorAppearance] = useState("");
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStep("loading");
    setErrorMessage(null);

    const hasActor = actorName.trim() && actorVoice.trim() && actorAppearance.trim();

    const request: ContentRequest = {
      project,
      objective,
      mode,
      productPhotoUrl: null,
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
    };

    try {
      const res = await runPipelineFn({ data: request });
      setResult(res);
      setStep(res.status === "aprovado" ? "resultado" : "manual");
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

  function updateSceneVideoPrompt(sceneIndex: number, videoPrompt: string) {
    setResult((prev) => {
      if (!prev) return prev;
      const scenes = prev.output.generation.scenes.map((s) => (s.index === sceneIndex ? { ...s, videoPrompt } : s));
      return { ...prev, output: { ...prev.output, generation: { ...prev.output.generation, scenes } } };
    });
  }

  function updateGeneration(generation: PipelineOutput["generation"]) {
    setResult((prev) => (prev ? { ...prev, output: { ...prev.output, generation } } : prev));
  }

  if (step === "loading") {
    return (
      <div className="app">
        <BrandRow />
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
        onSceneVideoPromptChange={updateSceneVideoPrompt}
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
      <div>
        <h1 className="h1">Criar</h1>
        <div className="h1-sub">Envie seu produto e defina o objetivo.</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div className="section-label">
            Projeto <span style={{ fontWeight: 500, color: "oklch(0.5 0.02 285)" }}>(decide se o Teólogo entra)</span>
          </div>
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
        </div>

        <div>
          <div className="section-label">{project === "jeova_fala" ? "Tema" : "Informações do produto"}</div>
          <textarea
            className="field-textarea"
            placeholder={
              project === "jeova_fala"
                ? "Ex: mensagem de deus pra você hoje forte, salmo 27, medo e confiança..."
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
            Enviando foto, a aparência é extraída da imagem real (não inventada) e travada em
            todas as cenas junto com a voz. Preenchendo os 3 campos, o Cinematográfico mantém
            essas características sem variar de cena pra cena.
          </div>
        </div>

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
      <h1 className="h1" style={{ fontSize: 18 }}>
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
              <div style={{ fontSize: 12 }}>{h}</div>
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

function SceneCard({
  scene,
  actorProfile,
  onVideoPromptChange,
}: {
  scene: PipelineOutput["generation"]["scenes"][number];
  actorProfile: ContentRequest["actorProfile"];
  onVideoPromptChange: (sceneIndex: number, videoPrompt: string) => void;
}) {
  const refineSceneFn = useServerFn(refineScene);
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  async function handleRefine() {
    if (!feedback.trim()) return;
    setRefining(true);
    try {
      const { videoPrompt } = await refineSceneFn({ data: { scene, actorProfile, feedback: feedback.trim() } });
      onVideoPromptChange(scene.index, videoPrompt);
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
        CENA {scene.index + 1} — {scene.role.toUpperCase()} · {scene.startSeconds}–{scene.endSeconds}s
      </div>
      <div className="scene-meta">Câmera: {scene.camera}</div>
      <div className="scene-meta">Ação: {scene.action}</div>
      <div style={{ fontSize: 12.5, marginBottom: 8 }}>{scene.narration}</div>
      {scene.onScreenText && (
        <div style={{ fontSize: 11, color: "oklch(0.7 0.02 285)", marginBottom: 8 }}>
          Texto na tela: {scene.onScreenText}
        </div>
      )}
      <div
        style={{
          fontSize: 11.5,
          background: "oklch(0.13 0.012 285)",
          border: "1px solid oklch(0.24 0.018 285)",
          borderRadius: 10,
          padding: 10,
          marginBottom: 8,
        }}
      >
        {scene.videoPrompt}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn-secondary"
          style={{ padding: "8px 12px", fontSize: 11.5 }}
          onClick={() => navigator.clipboard?.writeText(scene.videoPrompt)}
        >
          Copiar prompt desta cena
        </button>
        <button
          className="btn-secondary"
          style={{ padding: "8px 12px", fontSize: 11.5 }}
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
          <button className="btn-primary" style={{ fontSize: 11.5, padding: "8px 12px" }} onClick={handleRefine} disabled={refining}>
            {refining ? "Ajustando..." : "Ajustar só essa cena"}
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
          <div style={{ fontSize: 12, color: "oklch(0.7 0.02 285)", marginBottom: 10 }}>
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
        <div style={{ fontSize: 12.5, marginBottom: 8 }}>{generation.caption}</div>
        {warnings.length > 0 && (
          <div className="reject-card" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Checagem automática encontrou possível problema:</div>
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
          style={{ padding: "8px 12px", fontSize: 11.5 }}
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
  onSceneVideoPromptChange,
  onGenerationUpdate,
}: {
  output: PipelineOutput;
  approved: boolean;
  onReset: () => void;
  onSceneVideoPromptChange: (sceneIndex: number, videoPrompt: string) => void;
  onGenerationUpdate: (generation: GenerationResult) => void;
}) {
  const { generation, compliance } = output;

  return (
    <div className="app">
      <BrandRow />
      <h1 className="h1" style={{ fontSize: 18 }}>
        {approved ? "Roteiro aprovado ✓" : "Roteiro (compliance pendente)"}
      </h1>

      <div>
        <div className="section-label">Hook selecionado</div>
        <div className="card" style={{ fontStyle: "italic", fontSize: 13 }}>
          "{generation.selectedHook}"
        </div>
      </div>

      <div>
        <div className="section-label">Cenas — prompts prontos pro Flow</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {generation.scenes.map((scene) => (
            <SceneCard
              key={scene.index}
              scene={scene}
              actorProfile={output.request.actorProfile}
              onVideoPromptChange={onSceneVideoPromptChange}
            />
          ))}
        </div>
      </div>

      <SeoSection output={output} onSeoResult={onGenerationUpdate} />

      {approved ? (
        <div className="approve-card">
          <div style={{ fontWeight: 700, fontSize: 13 }}>Compliance aprovado</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{compliance.checkedGroups.length} grupos de regra verificados.</div>
        </div>
      ) : (
        <div className="reject-card">
          <div style={{ fontWeight: 700, fontSize: 13 }}>Correção necessária</div>
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
              generation.scenes.map((s) => `Cena ${s.index + 1}:\n${s.videoPrompt}`).join("\n\n"),
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
      <h1 className="h1" style={{ fontSize: 18 }}>
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
