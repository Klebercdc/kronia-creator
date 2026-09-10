import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { runContentPipeline, type RunPipelineResult } from "../server/pipeline.functions";
import type { ContentRequest, PipelineOutput } from "../types/pipeline";

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

  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<RunPipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [project, setProject] = useState<ContentRequest["project"]>("comercial");
  const [objective, setObjective] = useState<ContentRequest["objective"]>("vender");
  const [mode, setMode] = useState<ContentRequest["mode"]>("tiktok_shop");
  const [productInfoText, setProductInfoText] = useState("");
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStep("loading");
    setErrorMessage(null);

    const request: ContentRequest = {
      project,
      objective,
      mode,
      productPhotoUrl: null,
      productInfo: productInfoText.trim()
        ? [{ text: productInfoText.trim(), kind: "fato", source: "campo de informações" }]
        : [],
      referenceVideoUrl: referenceVideoUrl.trim() || null,
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
    return <RoteiroView output={result.output} approved={result.status === "aprovado"} onReset={reset} />;
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
          <div className="section-label">Informações do produto</div>
          <textarea
            className="field-textarea"
            placeholder="Nome, material, benefícios conhecidos..."
            value={productInfoText}
            onChange={(e) => setProductInfoText(e.target.value)}
          />
          <div className="hint">Usado apenas o que você informar aqui — nada é inventado sobre o produto.</div>
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

function RoteiroView({
  output,
  approved,
  onReset,
}: {
  output: PipelineOutput;
  approved: boolean;
  onReset: () => void;
}) {
  const { generation, compliance, estimatedCreditsForVideo } = output;
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
        <div className="section-label">Cenas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {generation.scenes.map((scene) => (
            <div key={scene.index} className="card">
              <div className="scene-tag">
                CENA {scene.index + 1} — {scene.role.toUpperCase()} · {scene.startSeconds}–{scene.endSeconds}s
              </div>
              <div className="scene-meta">Câmera: {scene.camera}</div>
              <div className="scene-meta">Ação: {scene.action}</div>
              <div style={{ fontSize: 12.5 }}>{scene.narration}</div>
              {scene.onScreenText && (
                <div style={{ fontSize: 11, color: "oklch(0.7 0.02 285)", marginTop: 4 }}>
                  Texto na tela: {scene.onScreenText}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label">Prompt de vídeo</div>
        <div className="card" style={{ fontSize: 12 }}>
          {generation.videoPrompt}
        </div>
      </div>

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

      <div className="cost-row">Custo estimado: {estimatedCreditsForVideo} créditos para gerar o vídeo</div>

      <div className="btn-row">
        <button
          className="btn-secondary"
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(generation, null, 2))}
        >
          Copiar
        </button>
        <button className="btn-primary" disabled={!approved} style={{ flex: 1.4 }}>
          Gerar vídeo
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
