/**
 * Testes determinísticos (sem chamada de IA, sem custo) do fechamento da
 * Fase 1 — validação estrutural de flowSegments (timing/narrativeFunction/
 * gestureMap/heroShotFormula) e o bug de flaggedText do cliche-guard.
 * Letras A-M seguem exatamente a lista de testes obrigatórios do spec de
 * "CORREÇÃO FINAL E FECHAMENTO REAL"; N-P cobrem heroShotFormula (Correção
 * 6, tratada nesta mesma Fase 1, fora da lista original mas com o mesmo
 * padrão de checagem). Mesmo padrão de script `tsx` manual já usado no
 * repo (não há framework de teste instalado) — falha com process.exit(1)
 * e mensagem clara se qualquer asserção não bater.
 * Uso: npx tsx scripts/unit-tests-fase1-correcoes.ts
 */
import {
  validateSegmentTiming,
  validateNarrativeFunction,
  validateHeroShotFormulas,
  validateGestureMap,
} from "../src/core/generation/flow-segment-validator";
import { checkCliches } from "../src/core/compliance/cliche-guard";
import { GenerationResultSchema, type FlowSegment, type GenerationResult, type ScriptScene } from "../src/types/pipeline";

let failures = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  OK   ${testName}`);
  } else {
    failures++;
    console.log(`  FAIL ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

function segment(partial: Partial<FlowSegment> & Pick<FlowSegment, "index" | "startSeconds" | "endSeconds">): FlowSegment {
  return {
    sceneIndexes: [],
    videoPrompt: "placeholder",
    gaze: "placeholder",
    gestureMap: [],
    voiceTimbre: "placeholder",
    interpretationMode: "placeholder",
    narrativeFunction: null,
    heroShotFormula: null,
    customHeroShotFormulaLabel: null,
    ...partial,
  };
}

function scene(partial: Partial<ScriptScene> & Pick<ScriptScene, "index" | "narration">): ScriptScene {
  return {
    role: "hook",
    startSeconds: 0,
    endSeconds: 10,
    camera: "close-up",
    action: "produto na mão",
    onScreenText: null,
    videoPrompt: "",
    ...partial,
  };
}

function minimalGeneration(overrides: { hooks?: string[]; scenes?: GenerationResult["scenes"]; caption?: string }): GenerationResult {
  return GenerationResultSchema.parse({
    hooks: overrides.hooks ?? ["h1", "h2", "h3", "h4", "h5"],
    selectedHook: "h1",
    scenes: overrides.scenes ?? [],
    flowSegments: [],
    claims: [],
    caption: overrides.caption ?? "",
    hashtags: [],
    decisionLog: [],
  });
}

// ---- A/B: durações válidas ----

function testA_flow30sValido() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10 }),
    segment({ index: 1, startSeconds: 10, endSeconds: 20 }),
    segment({ index: 2, startSeconds: 20, endSeconds: 30 }),
  ];
  const issues = validateSegmentTiming(segs, 30);
  assert(issues.length === 0 && segs.length === 3, "Teste A — flow 30s válido → 3 segmentos, PASS", issues.join(" | "));
}

function testB_flow60sValido() {
  const segs = Array.from({ length: 6 }, (_, i) => segment({ index: i, startSeconds: i * 10, endSeconds: (i + 1) * 10 }));
  const issues = validateSegmentTiming(segs, 60);
  assert(issues.length === 0 && segs.length === 6, "Teste B — flow 60s válido → 6 segmentos, PASS", issues.join(" | "));
}

// ---- C/D: duração de segmento errada ----

function testC_segmento9sFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 9 }),
    segment({ index: 1, startSeconds: 9, endSeconds: 19 }),
    segment({ index: 2, startSeconds: 19, endSeconds: 29 }),
  ];
  const issues = validateSegmentTiming(segs, 29);
  assert(issues.length > 0, "Teste C — segmento com 9s FAIL (detectado)", `issues=${issues.length}`);
}

function testD_segmento11sFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 11 }),
    segment({ index: 1, startSeconds: 11, endSeconds: 21 }),
    segment({ index: 2, startSeconds: 21, endSeconds: 30 }),
  ];
  const issues = validateSegmentTiming(segs, 30);
  assert(issues.length > 0, "Teste D — segmento com 11s FAIL (detectado)", `issues=${issues.length}`);
}

// ---- E/F: gap e overlap ----

function testE_gapFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10 }),
    segment({ index: 1, startSeconds: 12, endSeconds: 22 }),
    segment({ index: 2, startSeconds: 22, endSeconds: 30 }),
  ];
  const issues = validateSegmentTiming(segs, 30);
  assert(issues.length > 0, "Teste E — gap entre segmentos FAIL (detectado)", `issues=${issues.length}`);
}

function testF_overlapFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10 }),
    segment({ index: 1, startSeconds: 8, endSeconds: 18 }),
    segment({ index: 2, startSeconds: 18, endSeconds: 30 }),
  ];
  const issues = validateSegmentTiming(segs, 30);
  assert(issues.length > 0, "Teste F — overlap entre segmentos FAIL (detectado)", `issues=${issues.length}`);
}

// ---- G/H: narrativeFunction ----

function testG_narrativeFunctionIncorretoFalha() {
  // 60s, primeiro segmento = desenvolvimento (deveria ser gancho)
  const segs = Array.from({ length: 6 }, (_, i) =>
    segment({
      index: i,
      startSeconds: i * 10,
      endSeconds: (i + 1) * 10,
      narrativeFunction: i === 0 ? "desenvolvimento" : i === 5 ? "cta" : "desenvolvimento",
    }),
  );
  const issues = validateNarrativeFunction(segs, 60);
  assert(issues.length > 0, "Teste G — narrativeFunction incorreto (60s, primeiro=desenvolvimento) FAIL", `issues=${issues.length}`);
}

function testH_ctaNoMeioDesenvolvimentoNoFinalFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10, narrativeFunction: "gancho" }),
    segment({ index: 1, startSeconds: 10, endSeconds: 20, narrativeFunction: "cta" }),
    segment({ index: 2, startSeconds: 20, endSeconds: 30, narrativeFunction: "desenvolvimento" }),
  ];
  const issues = validateNarrativeFunction(segs, 30);
  assert(issues.length > 0, "Teste H — cta no meio e desenvolvimento no último FAIL", `issues=${issues.length}`);
}

// ---- I: cliche-guard flaggedText ----

function testI_clicheFlaggedTextEhTrechoReal() {
  const generation = minimalGeneration({
    scenes: [scene({ index: 0, narration: "Você já parou pra pensar em como esse produto muda seu estilo?" })],
  });

  const violations = checkCliches(generation);
  const hit = violations.find((v) => v.group === "cliche_generico");
  assert(!!hit, "Teste I (pré-condição) — clichê detectado no texto de teste");
  assert(
    !!hit && hit.flaggedText.length < generation.scenes[0].narration.length,
    "Teste I — flaggedText é só o trecho do regex, não o campo inteiro",
    hit ? `flaggedText="${hit.flaggedText}"` : undefined,
  );
  assert(
    !!hit && generation.scenes[0].narration.toLowerCase().includes(hit.flaggedText.toLowerCase()),
    "Teste I — flaggedText é de fato uma substring real do campo original",
  );
}

// ---- J/K: gestureMap ----

function testJ_gestureMapValidoPassa() {
  const scenes = [scene({ index: 0, narration: "Ao pronunciar a palavra fé, ele toca o anel com o polegar." })];
  const segs = [
    segment({
      index: 0,
      startSeconds: 0,
      endSeconds: 10,
      sceneIndexes: [0],
      gestureMap: [{ trigger: "ao pronunciar a palavra fé", gesture: "toca o anel com o polegar" }],
    }),
  ];
  const issues = validateGestureMap(segs, scenes);
  assert(issues.length === 0, "Teste J — gestureMap com trigger presente na fala PASS", issues.join(" | "));
}

function testK_gestureMapInvalidoFalha() {
  const scenes = [scene({ index: 0, narration: "Este anel é ajustável e resistente à água." })];
  const segs = [
    segment({
      index: 0,
      startSeconds: 0,
      endSeconds: 10,
      sceneIndexes: [0],
      gestureMap: [{ trigger: "momento importante", gesture: "gesticula naturalmente" }],
    }),
  ];
  const issues = validateGestureMap(segs, scenes);
  assert(issues.length > 0, "Teste K — gestureMap com trigger inexistente na fala FAIL", `issues=${issues.length}`);
}

// ---- L/M: sequência completa de narrativeFunction ----

function testL_sequencia30sPassa() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10, narrativeFunction: "gancho" }),
    segment({ index: 1, startSeconds: 10, endSeconds: 20, narrativeFunction: "desenvolvimento" }),
    segment({ index: 2, startSeconds: 20, endSeconds: 30, narrativeFunction: "cta" }),
  ];
  const issues = validateNarrativeFunction(segs, 30);
  assert(issues.length === 0, "Teste L — 30s gancho→desenvolvimento→cta PASS", issues.join(" | "));
}

function testM_sequencia60sPassa() {
  const funcoes = ["gancho", "desenvolvimento", "desenvolvimento", "desenvolvimento", "desenvolvimento", "cta"] as const;
  const segs = funcoes.map((fn, i) => segment({ index: i, startSeconds: i * 10, endSeconds: (i + 1) * 10, narrativeFunction: fn }));
  const issues = validateNarrativeFunction(segs, 60);
  assert(issues.length === 0, "Teste M — 60s gancho→4×desenvolvimento→cta PASS", issues.join(" | "));
}

// ---- N/O/P: heroShotFormula (Correção 6) ----

function testN_customFormulaSemLabelFalha() {
  const segs = [segment({ index: 0, startSeconds: 0, endSeconds: 10, heroShotFormula: "custom", customHeroShotFormulaLabel: null })];
  assert(validateHeroShotFormulas(segs).length === 1, "Teste N — heroShotFormula=custom sem label FAIL (detectado)");
}

function testO_labelSemCustomFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10, heroShotFormula: "reveal_liquido", customHeroShotFormulaLabel: "produto em uso" }),
  ];
  assert(validateHeroShotFormulas(segs).length === 1, "Teste O — label preenchido com fórmula não-custom FAIL (detectado)");
}

function testP_heroShotFormulaValidoPassa() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10, heroShotFormula: "reveal_liquido", customHeroShotFormulaLabel: null }),
    segment({ index: 1, startSeconds: 10, endSeconds: 20, heroShotFormula: null, customHeroShotFormulaLabel: null }),
    segment({
      index: 2,
      startSeconds: 20,
      endSeconds: 30,
      heroShotFormula: "custom",
      customHeroShotFormulaLabel: "produto em uso real, mão fechando o zíper",
    }),
  ];
  assert(validateHeroShotFormulas(segs).length === 0, "Teste P — combinações válidas de heroShotFormula/label PASS");
}

// ---- extra: duplicidade de índice (item 1.8 do spec) ----

function testQ_indiceDuplicadoFalha() {
  const segs = [
    segment({ index: 0, startSeconds: 0, endSeconds: 10 }),
    segment({ index: 0, startSeconds: 10, endSeconds: 20 }),
    segment({ index: 2, startSeconds: 20, endSeconds: 30 }),
  ];
  const issues = validateSegmentTiming(segs, 30);
  assert(issues.length > 0, "Teste Q — índice duplicado FAIL (detectado)", `issues=${issues.length}`);
}

function main() {
  console.log("Testes determinísticos — Fechamento real da Fase 1\n");

  console.log("Flow timing (A-F, Q):");
  testA_flow30sValido();
  testB_flow60sValido();
  testC_segmento9sFalha();
  testD_segmento11sFalha();
  testE_gapFalha();
  testF_overlapFalha();
  testQ_indiceDuplicadoFalha();

  console.log("\nnarrativeFunction (G/H, L/M):");
  testG_narrativeFunctionIncorretoFalha();
  testH_ctaNoMeioDesenvolvimentoNoFinalFalha();
  testL_sequencia30sPassa();
  testM_sequencia60sPassa();

  console.log("\ncliche-guard flaggedText (I):");
  testI_clicheFlaggedTextEhTrechoReal();

  console.log("\ngestureMap (J/K):");
  testJ_gestureMapValidoPassa();
  testK_gestureMapInvalidoFalha();

  console.log("\nheroShotFormula (N/O/P):");
  testN_customFormulaSemLabelFalha();
  testO_labelSemCustomFalha();
  testP_heroShotFormulaValidoPassa();

  console.log(`\n${failures === 0 ? "TODOS OS TESTES PASSARAM" : `${failures} TESTE(S) FALHARAM`}`);
  if (failures > 0) process.exit(1);
}

main();
