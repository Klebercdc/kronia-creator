import assert from "node:assert/strict";
import { CREATIVE_ROLES_BY_VARIANT, finalFalasFor, validateIntentSemantics, type BlocosVendaFieldsLike } from "../src/core/generation/blocos-venda-fala";
import { expectedCreativeBlockCount } from "../src/core/generation/creative-context";

const base: BlocosVendaFieldsLike = {
  gancho: "Eu não esperava que uma leitura tão simples pudesse dizer tanto.",
  produto: "o devocional Mulheres com Deus",
  funcao: "um momento diário de reflexão",
  dor: "a gente continua sorrindo mesmo quando precisa de uma palavra boa",
  fato: "São 365 dias",
  proposito: "alimentar a fé com constância",
  local: "carrinho laranja",
  prova: "", beneficioExtra: "", objecao: "",
};

for (const variant of ["curto", "padrao", "longo"] as const) {
  assert.equal(expectedCreativeBlockCount(variant), CREATIVE_ROLES_BY_VARIANT[variant].length);
}

const creative = {
  ...base,
  strategy: {
    intent: "sales" as const, objective: "conversion", theme: "fé no cotidiano",
    coreTruth: "uma prática simples pode criar um momento de constância",
    audience: "pessoas que valorizam uma rotina de fé", emotionalStart: "cansaço", emotionalEnd: "acolhimento",
    hookMechanic: "relatable_pain", narrativeArc: "identificação → descoberta → benefício → ação",
    ctaObjective: "purchase" as const, verifiedFacts: ["365 dias"], observedVisuals: ["livro físico"], creativeAssumptions: [],
  },
  roteiro: [
    { role: "gancho", fala: "Tem dias em que uma palavra certa chega na hora certa." },
    { role: "revelacao", fala: "Este devocional transforma alguns minutos do dia em um momento de reflexão." },
    { role: "dor", fala: "Porque manter a fé constante pode ser difícil quando a rotina aperta." },
    { role: "alivio", fala: "São 365 dias para criar pequenos momentos de presença e reflexão." },
    { role: "cta", fala: "Se quiser conhecer o devocional, confira o produto no carrinho laranja." },
  ],
};

const final = finalFalasFor(creative, "padrao");
assert.deepEqual(final, creative.roteiro.map((block) => block.fala));

const badSalesCta = { ...creative, cta: "Se essa mensagem fez sentido para você, compartilhe." };
assert.ok(validateIntentSemantics(badSalesCta, "sales").length > 0);

const goodSalesCta = { ...creative, cta: "Confira o produto no carrinho laranja." };
assert.equal(validateIntentSemantics(goodSalesCta, "sales").length, 0);

const legacy = finalFalasFor(base, "padrao");
assert.equal(legacy.length, 5);
assert.ok(legacy[0].length > 0);

console.log("creative engine smoke test: PASS");
