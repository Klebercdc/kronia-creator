import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMovementCategoriesFn,
  listMovementsByCategoryFn,
  composeMovementPromptFn,
  FORMAT_LABEL,
  BODY_PART_LABEL,
  bodyPartsFor,
  type MovementCategory,
  type MovementEntry,
  type MovementFormat,
  type SubjectType,
  type BodyPart,
} from "../server/movement-library.functions";
import { listHookTypesFn, generateHookPromptFn, type HookType } from "../server/hook-avancado.functions";
import { errorMessageOf } from "../lib/errors";

const SUBJECT_OPTIONS: { value: SubjectType; label: string }[] = [
  { value: "person", label: "Avatar (pessoa)" },
  { value: "product", label: "Objeto (produto)" },
];

const FORMAT_ORDER: MovementFormat[] = ["padrao", "pov", "ugc", "cta", "sequencia"];
const BODY_PART_ORDER: BodyPart[] = ["cabelo", "maos", "corpo", "pernas", "rosto"];

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
  const listHookTypesRpc = useServerFn(listHookTypesFn);
  const generateHookRpc = useServerFn(generateHookPromptFn);

  const [categories, setCategories] = useState<MovementCategory[]>([]);
  const [hookTypes, setHookTypes] = useState<{ value: HookType; label: string }[]>([]);
  // Gancho narrativo avançado (opcional) — quando escolhido, "Gerar com IA"
  // pega os movimentos clicados e pede pra IA costurar tudo na metodologia
  // de abertura crítica + lista do que não mostrar (ver hook-avancado.ts).
  // null = só o modo determinístico (Gerar prompt final) fica disponível.
  const [hookType, setHookType] = useState<HookType | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Passo 1: Sujeito + Formato decidem o que aparece no passo 2 — nada de
  // rolar 28 categorias numa fileira só pra achar a certa.
  const [step, setStep] = useState<"config" | "browse">("config");
  const [subjectType, setSubjectType] = useState<SubjectType>("person");
  const [format, setFormat] = useState<MovementFormat>("padrao");

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [movements, setMovements] = useState<MovementEntry[]>([]);
  const [loading, setLoading] = useState(false);
  // Cruza com a categoria de roupa, não substitui — dentro da categoria
  // escolhida, filtra ainda mais por qual parte do corpo é o foco do gesto.
  // Só se aplica pra Avatar (pessoa); Objeto não tem essa dimensão.
  const [bodyPartFilter, setBodyPartFilter] = useState<BodyPart | null>(null);
  // Ordem de clique preservada — é a ordem que vira a sequência da cena final.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composed, setComposed] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listCategoriesRpc().then(setCategories);
    listHookTypesRpc().then(setHookTypes);
  }, []);

  useEffect(() => {
    if (!categorySlug) return;
    setLoading(true);
    setBodyPartFilter(null);
    listMovementsRpc({ data: { categorySlug } })
      .then(setMovements)
      .finally(() => setLoading(false));
  }, [categorySlug]);

  const categoriesInFormat = useMemo(() => categories.filter((c) => c.format === format), [categories, format]);
  const formatCounts = useMemo(() => {
    const counts = new Map<MovementFormat, number>();
    for (const c of categories) counts.set(c.format, (counts.get(c.format) ?? 0) + c.count);
    return counts;
  }, [categories]);

  const selectedMap = useMemo(() => new Map(movements.map((m) => [m.id, m])), [movements]);

  const visibleMovements = useMemo(() => {
    if (subjectType !== "person" || !bodyPartFilter) return movements;
    return movements.filter((m) => bodyPartsFor(m).includes(bodyPartFilter));
  }, [movements, subjectType, bodyPartFilter]);

  function goToBrowse() {
    setStep("browse");
    setCategorySlug(categoriesInFormat[0]?.slug ?? null);
  }

  function backToConfig() {
    setStep("config");
    setCategorySlug(null);
    setMovements([]);
    setSelectedIds([]);
    setComposed(null);
    setCopied(false);
  }

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
      const res = await composeRpc({ data: { ids: selectedIds, subjectType } });
      setComposed(res?.text ?? null);
    } finally {
      setComposing(false);
    }
  }

  async function handleGenerateAi() {
    if (!hookType) return;
    setGeneratingAi(true);
    setCopied(false);
    setAiError(null);
    try {
      const res = await generateHookRpc({ data: { movementIds: selectedIds, hookType, subjectType } });
      setComposed(res.prompt);
    } catch (err) {
      setAiError(errorMessageOf(err, "Erro ao gerar o prompt com IA"));
    } finally {
      setGeneratingAi(false);
    }
  }

  async function handleCopy() {
    if (!composed) return;
    try {
      await navigator.clipboard.writeText(composed);
      setCopied(true);
    } catch {
      // clipboard indisponível (ex: contexto não-seguro) — o texto já está
      // visível na caixa abaixo pra copiar manualmente.
    }
  }

  const totalSelectedDuration = selectedIds.reduce((sum, id) => sum + (selectedMap.get(id)?.durationSec ?? 0), 0);

  if (step === "config") {
    return (
      <div>
        <div className="hint" style={{ marginBottom: 14 }}>Escolha o sujeito e o formato pra filtrar os movimentos.</div>

        <div className="section-label" style={{ marginBottom: 6 }}>
          Sujeito
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {SUBJECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pill ${subjectType === opt.value ? "active" : ""}`}
              style={{ flex: 1, padding: "12px 0" }}
              onClick={() => setSubjectType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="section-label" style={{ marginBottom: 6 }}>
          Formato
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {FORMAT_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: format === f ? "1px solid var(--kr-accent-2)" : "1px solid var(--kr-line)",
                background: format === f ? "var(--kr-tint)" : "var(--kr-card)",
                color: format === f ? "var(--kr-accent-ink)" : "var(--kr-ink)",
                fontWeight: 700,
                fontSize: 14,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span>{FORMAT_LABEL[f]}</span>
              <span style={{ fontSize: 12, color: "var(--kr-muted-2)", fontWeight: 500 }}>
                {formatCounts.get(f) ?? 0} movimentos
              </span>
            </button>
          ))}
        </div>

        <button type="button" className="btn-primary" disabled={categoriesInFormat.length === 0} onClick={goToBrowse}>
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={backToConfig}
        style={{ background: "none", border: "none", color: "var(--kr-muted)", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 10 }}
      >
        ← {SUBJECT_OPTIONS.find((o) => o.value === subjectType)?.label} · {FORMAT_LABEL[format]}
      </button>

      <div className="hint" style={{ marginBottom: 10 }}>Marque os movimentos na ordem que devem acontecer.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {categoriesInFormat.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCategorySlug(c.slug)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: categorySlug === c.slug ? "1px solid var(--kr-accent-2)" : "1px solid var(--kr-line)",
              background: categorySlug === c.slug ? "var(--kr-tint)" : "var(--kr-card)",
              color: categorySlug === c.slug ? "var(--kr-accent-ink)" : "var(--kr-ink)",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span>
              {c.label}
              {c.engine === "veo3" ? " · Veo3" : ""}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--kr-muted-2)", fontWeight: 500 }}>{c.count}</span>
          </button>
        ))}
      </div>

      {loading && <div className="hint">Carregando…</div>}

      {subjectType === "person" && !loading && movements.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 10 }}>
          <button
            type="button"
            className={`pill ${bodyPartFilter === null ? "active" : ""}`}
            style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: 12 }}
            onClick={() => setBodyPartFilter(null)}
          >
            Todos
          </button>
          {BODY_PART_ORDER.map((part) => (
            <button
              key={part}
              type="button"
              className={`pill ${bodyPartFilter === part ? "active" : ""}`}
              style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: 12 }}
              onClick={() => setBodyPartFilter(part)}
            >
              {BODY_PART_LABEL[part]}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: selectedIds.length > 0 ? 140 : 16,
        }}
      >
        {!loading && visibleMovements.length === 0 && movements.length > 0 && (
          <div className="hint" style={{ gridColumn: "1 / -1" }}>
            Nenhum movimento aqui mexe nessa parte do corpo.
          </div>
        )}
        {visibleMovements.map((m) => {
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
              <div style={{ fontSize: 11, color: "var(--kr-ink)", lineHeight: 1.25 }}>{m.title}</div>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: "env(safe-area-inset-bottom)",
            background: "var(--kr-card)",
            border: "1px solid var(--kr-line)",
            boxShadow: "0 2px 10px var(--kr-shadow)",
            borderRadius: 14,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--kr-muted)" }}>
            <span>
              {selectedIds.length} movimento{selectedIds.length > 1 ? "s" : ""} selecionado{selectedIds.length > 1 ? "s" : ""} · ~
              {totalSelectedDuration}s
            </span>
            <button type="button" onClick={clearSelection} style={{ background: "none", border: "none", color: "var(--kr-muted-2)", fontSize: 12, cursor: "pointer" }}>
              Limpar
            </button>
          </div>

          {!composed ? (
            <>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--kr-muted)", marginBottom: 6 }}>
                  Gancho narrativo avançado (opcional) — abertura tipo "motoboy na porta", escrita pela IA a partir
                  dos movimentos marcados:
                </div>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  <button
                    type="button"
                    className={`pill ${hookType === null ? "active" : ""}`}
                    style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: 12 }}
                    onClick={() => setHookType(null)}
                  >
                    Nenhum
                  </button>
                  {hookTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`pill ${hookType === t.value ? "active" : ""}`}
                      style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: 12 }}
                      onClick={() => setHookType(t.value)}
                    >
                      {t.label.split("/")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" disabled={composing} onClick={handleGenerate} style={{ flex: 1 }}>
                  {composing ? "Montando…" : "Gerar prompt final"}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!hookType || generatingAi}
                  onClick={handleGenerateAi}
                  style={{ flex: 1 }}
                >
                  {generatingAi ? "Escrevendo…" : "Gerar com IA"}
                </button>
              </div>
              {aiError && (
                <div className="hint" style={{ color: "#DC2626", fontSize: 11.5 }}>
                  {aiError}
                </div>
              )}
            </>
          ) : (
            <>
              <textarea
                className="input"
                readOnly
                rows={5}
                value={composed}
                style={{ fontSize: 12.5, resize: "vertical" }}
              />
              <div className="hint" style={{ fontSize: 11.5 }}>
                Cole esse texto <strong>junto com a foto de referência</strong> no Flow (Ingredients to Video).
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
