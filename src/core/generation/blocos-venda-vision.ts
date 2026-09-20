import { z } from "zod";
import { callStructuredText, callStructuredVisionFromDataUrls } from "../../lib/openai";
import { PERSUASION_MECHANISMS } from "../../types/taxonomy";
import { BANNED_PHRASES } from "../compliance/absolute-claims-guard";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";
import { buildHookLibraryPromptBlock } from "./hook-library";
import { CreativeStrategySchema, CreativeBlockSchema, expectedCreativeBlockCount } from "./creative-context";
import {
  checkFalaLengths,
  checkStructuralIssues,
  enforceFalaBudgets,
  fieldsUsedBy,
  VARIANT_LABEL,
  type BlocosVendaVariant,
  validateIntentSemantics,
  CREATIVE_ROLES_BY_VARIANT,
} from "./blocos-venda-fala";

/**
 * Preenche os 17 campos do gerador de blocos de venda a partir da foto do
 * avatar/personagem com o produto — o usuário não digita nada, só anexa a
 * foto (e opcionalmente um contexto curto). Uma chamada de visão só, porque
 * os campos são interdependentes (o nome do personagem, o tom da voz e o
 * público entram todos na mesma frase-modelo) e ficam mais coerentes
 * escritos juntos do que emendados de 3 chamadas separadas. 3 dos 17 campos
 * (prova/beneficioExtra/objecao) só são usados na variante "longo".
 */

const FieldsSchema = z.object({
  nome: z.string(),
  gancho: z.string(),
  produto: z.string(),
  funcao: z.string(),
  dor: z.string(),
  fato: z.string(),
  proposito: z.string(),
  local: z.string(),
  visual: z.string(),
  demo: z.string(),
  idv: z.string(),
  voz: z.string(),
  cen: z.string(),
  /** Só usado na variante "longo" — deixe "" nas outras variantes. */
  prova: z.string(),
  beneficioExtra: z.string(),
  objecao: z.string(),
  strategy: CreativeStrategySchema.optional(),
  roteiro: z.array(CreativeBlockSchema).max(8).optional(),
});

export type BlocosVendaFields = z.infer<typeof FieldsSchema>;

/** Técnicas por PAPEL do bloco (não por número fixo — o número varia por
 * variante de duração: CTA é bloco 3 no "curto", bloco 5 no "padrao", bloco
 * 8 no "longo") — checadas contra a taxonomia real do app
 * (types/taxonomy.ts) em vez de string solta: se um desses nomes for
 * removido/renomeado na taxonomia, o build quebra aqui em vez de o prompt
 * silenciosamente citar uma técnica que não existe mais. */
function fromMechanisms(...names: (typeof PERSUASION_MECHANISMS)[number][]): string {
  return names.join(" + ");
}
const REVELACAO_TECNICA = fromMechanisms("beneficio");
const DOR_TECNICA = fromMechanisms("problema_solucao", "desejo");
const PROVA_TECNICA = fromMechanisms("prova_social");
const ALIVIO_TECNICA = fromMechanisms("alivio");
const BENEFICIO_EXTRA_TECNICA = fromMechanisms("beneficio");
const OBJECAO_TECNICA = fromMechanisms("contraste");
const CTA_TECNICA = fromMechanisms("cta_claro");

/** Bloco fixo — cada variante usa só um subconjunto dos campos; o resto
 * fica como string vazia "". Nunca invente conteúdo pros campos não
 * usados só pra "preencher". */
function buildVariantDirective(variant: BlocosVendaVariant): string {
  const used = fieldsUsedBy(variant);
  const all: { campo: string; usado: boolean }[] = [
    { campo: "gancho", usado: used.has("gancho") },
    { campo: "produto", usado: used.has("produto") },
    { campo: "funcao", usado: used.has("funcao") },
    { campo: "dor", usado: used.has("dor") },
    { campo: "prova", usado: used.has("prova") },
    { campo: "fato", usado: used.has("fato") },
    { campo: "proposito", usado: used.has("proposito") },
    { campo: "beneficioExtra", usado: used.has("beneficioExtra") },
    { campo: "objecao", usado: used.has("objecao") },
    { campo: "local", usado: used.has("local") },
  ];
  const usados = all.filter((c) => c.usado).map((c) => c.campo);
  const naoUsados = all.filter((c) => !c.usado).map((c) => c.campo);
  return `VARIANTE ATUAL: "${VARIANT_LABEL[variant]}". Preencha SÓ estes campos de fala com conteúdo
real: ${usados.join(", ")}. Os campos ${naoUsados.length ? naoUsados.join(", ") : "(nenhum)"} NÃO são
usados nessa variante — deixe como string vazia "", nunca invente conteúdo pra eles só pra
"preencher". Os campos visuais/de personagem (nome, visual, demo, idv, voz, cen) são sempre
preenchidos, em qualquer variante.`;
}

const SYSTEM_BASE = `Você é o motor criativo do KRONIA Creator.

HIERARQUIA:
1. O BRIEFING CRIATIVO explícito do usuário define intenção, objetivo, tema, público e direção.
2. A IMAGEM define identidade visual, produto, cenário e características observáveis.
3. O contexto adicional apenas complementa o briefing sem contradizer a imagem.
4. Moldes legados de venda são somente fallback técnico e nunca substituem uma intenção explícita.

INTENÇÃO:
message = reflexão/emoção/aplicação, sem CTA de compra.
engagement = interação.
sales = venda/conversão, com CTA comercial somente quando solicitado.
script = narrativa audiovisual.
custom = seguir o briefing.

EVIDÊNCIA:
Não invente números, prova social, depoimentos, eficácia, resultados, preço, promoção ou características não verificáveis.

COMPLIANCE:
Não use alegações como "transformou vidas" ou "tem ajudado gerações" sem evidência fornecida. Em conteúdo cristão, o personagem não fala como Deus em primeira pessoa.

ROTEIRO:
O roteiro livre é a saída principal. Cada fala deve ser natural e avançar a narrativa. Timing é validado depois; não sacrifique naturalidade para preencher molde.

Use somente os dados desta chamada. Nunca carregue contexto de outra geração.
Retorne os campos do schema e nada além disso.`;

function buildSystem(variant: BlocosVendaVariant): string {
  const roles = CREATIVE_ROLES_BY_VARIANT[variant].join(" → ");
  const count = expectedCreativeBlockCount(variant);
  const directive = `PROTOCOLO CRIATIVO — execute antes de escrever:
1. OBSERVE: use apenas evidências visuais e dados explicitamente fornecidos.
2. CONTEXTUALIZE: determine perfil, produto, público, plataforma, duração e briefing desta chamada.
3. INTENÇÃO: determine a intenção real; neste módulo, o padrão é sales salvo indicação explícita.
4. OBJETIVO: determine o comportamento desejado.
5. OPORTUNIDADE: encontre o elemento visual/narrativo com maior potencial de atenção.
6. IDEIA: defina tema, verdade central, tensão/desejo e arco emocional.
7. ESTRATÉGIA: escolha a mecânica adequada; não comece por uma frase pronta.
8. ESCRITA: escreva a fala completa de cada bloco, sem montar frases por fragmentos.
9. VALIDAÇÃO: confira contexto, intenção, claims, naturalidade, timing e continuidade.

Não exponha cadeia de pensamento privada. Retorne somente os campos do schema.

DECISÃO ESTRUTURADA: preencha strategy com intent, objective, theme, coreTruth, audience, emotionalStart, emotionalEnd, hookMechanic, narrativeArc, ctaObjective, verifiedFacts, observedVisuals e creativeAssumptions.

ROTEIRO FINAL: preencha roteiro com exatamente ${count} blocos. Roles: ${roles}. Cada fala é completa, natural e específica para a referência atual. O roteiro final tem prioridade sobre os moldes legados.

REGRA VISUAL: não repita na fala o que a câmera já mostra sem função narrativa.
REGRA DE RETENÇÃO: cada bloco deve avançar o anterior; não entregue o payoff cedo demais.
REGRA DE CTA: o CTA nasce da intenção + objetivo.
`;
  return `${SYSTEM_BASE}\n\n${directive}\n${buildVariantDirective(variant)}`;
}

/** Revisor de Roteiro do Blocos de venda — mesmo papel do Quality Judge do
 * pipeline principal (quality-judge.ts), mas julgando as FRASES FINAIS
 * MONTADAS como um roteiro só (não os campos isolados): gramática,
 * persuasão (cada bloco realmente convence, ou é só bonito?) e
 * direcionamento (os blocos formam um arco coerente — gancho →
 * desenvolvimento → CTA — ou parecem frases soltas coladas sem conexão?).
 * Reaproveita a mesma barra de qualidade criativa (CREATIVE_QUALITY_BAR) e
 * a mesma taxonomia de técnica por papel já usadas no prompt de geração,
 * em vez de duplicar critério novo. Genérico por variante — não assume
 * número fixo de blocos. */
const JudgmentSchema = z.object({
  naturalidade: z.number().min(0).max(10),
  especificidade: z.number().min(0).max(10),
  persuasao: z.number().min(0).max(10),
  direcionamento: z.number().min(0).max(10),
  weakestField: z.string(),
  revisionInstruction: z.string().nullable(),
});

const JUDGE_SYSTEM = `Você é o Revisor de Roteiro do Blocos de venda — não escreve nada, só avalia
com rigor as FALAS FINAIS do roteiro, exatamente como o usuário vai ler/falar, como um roteiro único
e contínuo, procurando motivo pra reprovar
texto mediano, clichê, robótico, gramaticalmente quebrado, ou que não persuade de verdade.

Você recebe os campos crus E as falas finais, em ordem. Julgue SEMPRE pela fala final e pelo arco completo. Os campos semânticos são evidência auxiliar; o roteiro livre é a saída principal.

${CREATIVE_QUALITY_BAR}

Técnica esperada por PAPEL (mesma taxonomia usada na geração — nem toda variante usa todos os
papéis, julgue só os que aparecerem nas frases montadas que você recebeu):
- Gancho (gancho): qualquer mecânica do repertório de hooks (curiosity, pattern_interrupt,
  identity_call, result_first etc.) — precisa realmente interromper o scroll, soar como fala
  natural (não copy de anúncio) e não cair na fórmula "Se você é X que valoriza Y...". Julgue se a
  escolha combina com o produto/foto, não se bateu uma técnica fixa.
- Revelação (produto+funcao): "${REVELACAO_TECNICA}" — a função tem que ser o benefício real desse
  produto.
- Dor (dor): "${DOR_TECNICA}" — dor específica e reconhecível, não genérica.
- Prova (prova): "${PROVA_TECNICA}" — detalhe concreto e verificável, nunca inventado.
- Alívio (fato+proposito): "${ALIVIO_TECNICA}" — fecha o arco emocional aberto na Dor.
- Benefício extra (beneficioExtra): "${BENEFICIO_EXTRA_TECNICA}" — um segundo benefício real,
  nunca repetição do que já foi dito em Revelação/Alívio.
- Objeção (objecao): "${OBJECAO_TECNICA}" — responde uma dúvida real e comum, nunca inventada.
- CTA (local): "${CTA_TECNICA}" — liga o CTA à mensagem inteira, não só ao produto solto.

Dê nota de 0 a 10 em 4 eixos:
- naturalidade: as frases MONTADAS soam como alguém falando de verdade em português correto, ou tem
  erro de concordância/verbo duplicado/preposição sobrando? Qualquer erro gramatical na frase
  montada derruba essa nota pra abaixo de 5, mesmo que o resto do texto esteja bom.
- especificidade: usa o produto/personagem REAL da foto, ou serviria pra qualquer produto do
  mesmo nicho?
- persuasao: cada bloco realmente aplica a técnica esperada do papel dele (acima) de um jeito que
  convenceria alguém de verdade, ou é só um enfeite de linguagem sem força persuasiva real?
- direcionamento: os blocos, lidos em sequência, formam UM arco coerente (o público do Gancho é o
  mesmo que sente a Dor e recebe o Alívio; o CTA fecha a mensagem do Gancho), ou parecem frases
  soltas coladas sem conexão entre si?

"weakestField": o nome do campo mais fraco (ex.: "fato", "dor").
"revisionInstruction": se QUALQUER eixo estiver abaixo de 8, escreva uma instrução CIRÚRGICA (o que
reescrever, em qual campo, por quê, citando a frase montada quebrada ou o ponto do arco que não
conecta) — senão, null.`;

async function judgeFields(fields: BlocosVendaFields, variant: BlocosVendaVariant) {
  const falasMontadas = checkFalaLengths(fields, variant)
    .map((c) => `Bloco ${c.bloco}: "${c.fala}"`)
    .join("\n");
  return callStructuredText({
    schema: JudgmentSchema,
    system: JUDGE_SYSTEM,
    prompt: `Campos gerados:\n${JSON.stringify(fields, null, 2)}\n\nFrases finais montadas (roteiro completo, leia em sequência):\n${falasMontadas}`,
    toolName: "blocos_venda_judgment",
  });
}

const REVISE_SYSTEM = `Você reescreve os campos de um gerador de vídeo de venda a partir de UMA
instrução cirúrgica de qualidade. Aplique a instrução só no(s) campo(s) indicado(s), mantendo os
outros campos exatamente como estão (inclusive os campos vazios "" que a variante atual não usa —
nunca preencha um campo que estava vazio, a menos que a instrução peça isso explicitamente). Nunca
invente característica, número ou prova do produto que não esteja nos campos já existentes. Retorne
os campos completos, no mesmo formato de entrada.`;

async function reviseFields(fields: BlocosVendaFields, instruction: string): Promise<BlocosVendaFields> {
  return callStructuredText({
    schema: FieldsSchema,
    system: REVISE_SYSTEM,
    prompt: `Campos atuais:\n${JSON.stringify(fields, null, 2)}\n\nInstrução de revisão:\n${instruction}`,
    toolName: "blocos_venda_fields",
  });
}

/** Junta as checagens determinísticas (duração + gramática/repetição) numa
 * só instrução — essas nunca dependem de julgamento de IA, só de regra e
 * fórmula em código, porque a LLM já demonstrou (na prática) não seguir
 * essas regras de forma confiável só por estarem escritas no prompt. */
function deterministicInstruction(fields: BlocosVendaFields, variant: BlocosVendaVariant): string | null {
  const checks = checkFalaLengths(fields, variant);
  const lengthIssues = checks
    .filter((c) => c.over)
    .map(
      (c) =>
        `Bloco ${c.bloco}: a fala tem ${c.chars} letras / ${c.words} palavras (~${c.secs.toFixed(0)}s) e passa do slot de 10s. Reescreva SOMENTE a fala desse bloco, preservando a ideia e os fatos, para aproximadamente 100–114 letras.`,
    );

  const underIssues = checks
    .filter((c) => c.under)
    .map(
      (c) =>
        `Bloco ${c.bloco}: a fala tem só ${c.chars} letras / ${c.words} palavras (~${c.secs.toFixed(0)}s). Elabore a mesma ideia com um detalhe REAL adicional, sem inventar fatos, até aproximadamente 95–114 letras.`,
    );

  const expectedRoles = CREATIVE_ROLES_BY_VARIANT[variant];
  const scriptIssues: string[] = [];
  if (fields.roteiro) {
    if (fields.roteiro.length !== expectedRoles.length) {
      scriptIssues.push(`O campo roteiro precisa ter exatamente ${expectedRoles.length} blocos, nos papéis: ${expectedRoles.join(", ")}.`);
    } else {
      fields.roteiro.forEach((block, index) => {
        if (block.role !== expectedRoles[index]) {
          scriptIssues.push(`O bloco ${index + 1} deve ter role "${expectedRoles[index]}", não "${block.role}".`);
        }
      });
    }
  }

  const intent = fields.strategy?.intent ?? "sales";
  const intentIssues = validateIntentSemantics(fields, intent);
  const structuralIssues = fields.roteiro?.length
    ? []
    : checkStructuralIssues(fields, variant);

  const all = [...lengthIssues, ...underIssues, ...scriptIssues, ...intentIssues, ...structuralIssues];
  return all.length ? all.join("\n") : null;
}

/** Analisa a(s) foto(s) do avatar+produto e devolve os campos do gerador já
 * preenchidos, pra variante de duração escolhida (padrão: "padrao", igual
 * ao comportamento de sempre). `contexto` é opcional — texto livre que o
 * usuário pode digitar pra dar informação que não dá pra ver na foto
 * (nome do produto se não estiver legível, público-alvo pretendido etc).
 *
 * Depois de gerar: (1) checagens determinísticas de duração/gramática em
 * código, (2) Quality Judge (mesma barra de qualidade criativa do resto do
 * KRONIA). Se algo reprovar, revisa — no máximo 2 rodadas (não um loop
 * aberto): a 1ª pega a maioria dos casos, a 2ª existe porque, na prática,
 * uma única revisão às vezes não corrige tudo de primeira. */
export async function generateBlocosVendaFields(
  imageDataUrls: string[],
  contexto?: string,
  variant: BlocosVendaVariant = "padrao",
): Promise<BlocosVendaFields> {
  const prompt = contexto?.trim()
    ? `Preencha os campos a partir desta foto. Contexto adicional dado pelo usuário (use pra completar o que a foto não mostra, mas não contradiga o que está visível): ${contexto.trim()}`
    : "Preencha os campos a partir desta foto.";

  let fields = await callStructuredVisionFromDataUrls({
    schfunction buildSystem(variant: BlocosVendaVariant): string {
  const roles = CREATIVE_ROLES_BY_VARIANT[variant].join(" → ");
  const count = expectedCreativeBlockCount(variant);
  const directive = `PROTOCOLO CRIATIVO:
1. OBSERVE: separe evidência visual de briefing.
2. CONTEXTUALIZE: trate o BRIEFING CRIATIVO como instrução principal.
3. INTENÇÃO: derive a intenção do briefing; não assuma sales quando ele pedir mensagem, reflexão, fé ou engajamento.
4. OBJETIVO: derive o comportamento desejado.
5. OPORTUNIDADE: encontre o elemento narrativo que melhor serve à intenção.
6. IDEIA: defina tema, verdade central, tensão/desejo e arco.
7. ESTRATÉGIA: escolha a mecânica adequada.
8. ESCRITA: escreva falas completas, sem montar frases por fragmentos.
9. VALIDAÇÃO: confira intenção, claims, CTA, naturalidade, timing e continuidade.

Preencha strategy com as decisões estruturadas.
Preencha roteiro com exatamente ${count} blocos, nos papéis ${roles}. O roteiro é a saída principal e tem prioridade sobre campos legados.

REGRA CRÍTICA:
Se o briefing pedir mensagem, reflexão, devocional, fé, esperança, consolo ou conteúdo semelhante sem pedir venda, trate como message.
Nesse caso NÃO use carrinho, link de compra, comprar, adquirir, preço, promoção ou CTA comercial.
Não invente prova social ou resultados.
O encerramento deve concluir a mensagem ou convidar a uma ação não comercial coerente.

Se o briefing pedir explicitamente venda, compra ou conversão, trate como sales.

Não exponha cadeia de pensamento privada. Retorne somente o schema.`;

  return `${SYSTEM_BASE}\n\n${directive}\n${buildVariantDirective(variant)}`;
}port { z } from "zod";
import { callStructuredText, callStructuredVisionFromDataUrls } from "../../lib/openai";
import { PERSUASION_MECHANISMS } from "../../types/taxonomy";
import { BANNED_PHRASES } from "../compliance/absolute-claims-guard";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";
import { buildHookLibraryPromptBlock } from "./hook-library";
import { CreativeStrategySchema, CreativeBlockSchema, expectedCreativeBlockCount } from "./creative-context";
import {
  checkFalaLengths,
  checkStructuralIssues,
  enforceFalaBudgets,
  fieldsUsedBy,
  VARIANT_LABEL,
  type BlocosVendaVariant,
  validateIntentSemantics,
  CREATIVE_ROLES_BY_VARIANT,
} from "./blocos-venda-fala";

/**
 * Preenche os 17 campos do gerador de blocos de venda a partir da foto do
 * avatar/personagem com o produto — o usuário não digita nada, só anexa a
 * foto (e opcionalmente um contexto curto). Uma chamada de visão só, porque
 * os campos são interdependentes (o nome do personagem, o tom da voz e o
 * público entram todos na mesma frase-modelo) e ficam mais coerentes
 * escritos juntos do que emendados de 3 chamadas separadas. 3 dos 17 campos
 * (prova/beneficioExtra/objecao) só são usados na variante "longo".
 */

const FieldsSchema = z.object({
  nome: z.string(),
  gancho: z.string(),
  produto: z.string(),
  funcao: z.string(),
  dor: z.string(),
  fato: z.string(),
  proposito: z.string(),
  local: z.string(),
  visual: z.string(),
  demo: z.string(),
  idv: z.string(),
  voz: z.string(),
  cen: z.string(),
  /** Só usado na variante "longo" — deixe "" nas outras variantes. */
  prova: z.string(),
  beneficioExtra: z.string(),
  objecao: z.string(),
  strategy: CreativeStrategySchema.optional(),
  roteiro: z.array(CreativeBlockSchema).max(8).optional(),
});

export type BlocosVendaFields = z.infer<typeof FieldsSchema>;

/** Técnicas por PAPEL do bloco (não por número fixo — o número varia por
 * variante de duração: CTA é bloco 3 no "curto", bloco 5 no "padrao", bloco
 * 8 no "longo") — checadas contra a taxonomia real do app
 * (types/taxonomy.ts) em vez de string solta: se um desses nomes for
 * removido/renomeado na taxonomia, o build quebra aqui em vez de o prompt
 * silenciosamente citar uma técnica que não existe mais. */
function fromMechanisms(...names: (typeof PERSUASION_MECHANISMS)[number][]): string {
  return names.join(" + ");
}
const REVELACAO_TECNICA = fromMechanisms("beneficio");
const DOR_TECNICA = fromMechanisms("problema_solucao", "desejo");
const PROVA_TECNICA = fromMechanisms("prova_social");
const ALIVIO_TECNICA = fromMechanisms("alivio");
const BENEFICIO_EXTRA_TECNICA = fromMechanisms("beneficio");
const OBJECAO_TECNICA = fromMechanisms("contraste");
const CTA_TECNICA = fromMechanisms("cta_claro");

/** Bloco fixo — cada variante usa só um subconjunto dos campos; o resto
 * fica como string vazia "". Nunca invente conteúdo pros campos não
 * usados só pra "preencher". */
function buildVariantDirective(variant: BlocosVendaVariant): string {
  const used = fieldsUsedBy(variant);
  const all: { campo: string; usado: boolean }[] = [
    { campo: "gancho", usado: used.has("gancho") },
    { campo: "produto", usado: used.has("produto") },
    { campo: "funcao", usado: used.has("funcao") },
    { campo: "dor", usado: used.has("dor") },
    { campo: "prova", usado: used.has("prova") },
    { campo: "fato", usado: used.has("fato") },
    { campo: "proposito", usado: used.has("proposito") },
    { campo: "beneficioExtra", usado: used.has("beneficioExtra") },
    { campo: "objecao", usado: used.has("objecao") },
    { campo: "local", usado: used.has("local") },
  ];
  const usados = all.filter((c) => c.usado).map((c) => c.campo);
  const naoUsados = all.filter((c) => !c.usado).map((c) => c.campo);
  return `VARIANTE ATUAL: "${VARIANT_LABEL[variant]}". Preencha SÓ estes campos de fala com conteúdo
real: ${usados.join(", ")}. Os campos ${naoUsados.length ? naoUsados.join(", ") : "(nenhum)"} NÃO são
usados nessa variante — deixe como string vazia "", nunca invente conteúdo pra eles só pra
"preencher". Os campos visuais/de personagem (nome, visual, demo, idv, voz, cen) são sempre
preenchidos, em qualquer variante.`;
}

const SYSTEM_BASE = `Você é o motor criativo do KRONIA Creator.

HIERARQUIA:
1. O BRIEFING CRIATIVO explícito do usuário define intenção, objetivo, tema, público e direção.
2. A IMAGEM define identidade visual, produto, cenário e características observáveis.
3. O contexto adicional apenas complementa o briefing sem contradizer a imagem.
4. Moldes legados de venda são somente fallback técnico e nunca substituem uma intenção explícita.

INTENÇÃO:
message = reflexão/emoção/aplicação, sem CTA de compra.
engagement = interação.
sales = venda/conversão, com CTA comercial somente quando solicitado.
script = narrativa audiovisual.
custom = seguir o briefing.

EVIDÊNCIA:
Não invente números, prova social, depoimentos, eficácia, resultados, preço, promoção ou características não verificáveis.

COMPLIANCE:
Não use alegações como "transformou vidas" ou "tem ajudado gerações" sem evidência fornecida. Em conteúdo cristão, o personagem não fala como Deus em primeira pessoa.

ROTEIRO:
O roteiro livre é a saída principal. Cada fala deve ser natural e avançar a narrativa. Timing é validado depois; não sacrifique naturalidade para preencher molde.

Use somente os dados desta chamada. Nunca carregue contexto de outra geração.
Retorne os campos do schema e nada além disso.`;

function buildSystem(variant: BlocosVendaVariant): string {
  const roles = CREATIVE_ROLES_BY_VARIANT[variant].join(" → ");
  const count = expectedCreativeBlockCount(variant);
  const directive = `PROTOCOLO CRIATIVO — execute antes de escrever:
1. OBSERVE: use apenas evidências visuais e dados explicitamente fornecidos.
2. CONTEXTUALIZE: determine perfil, produto, público, plataforma, duração e briefing desta chamada.
3. INTENÇÃO: determine a intenção real; neste módulo, o padrão é sales salvo indicação explícita.
4. OBJETIVO: determine o comportamento desejado.
5. OPORTUNIDADE: encontre o elemento visual/narrativo com maior potencial de atenção.
6. IDEIA: defina tema, verdade central, tensão/desejo e arco emocional.
7. ESTRATÉGIA: escolha a mecânica adequada; não comece por uma frase pronta.
8. ESCRITA: escreva a fala completa de cada bloco, sem montar frases por fragmentos.
9. VALIDAÇÃO: confira contexto, intenção, claims, naturalidade, timing e continuidade.

Não exponha cadeia de pensamento privada. Retorne somente os campos do schema.

DECISÃO ESTRUTURADA: preencha strategy com intent, objective, theme, coreTruth, audience, emotionalStart, emotionalEnd, hookMechanic, narrativeArc, ctaObjective, verifiedFacts, observedVisuals e creativeAssumptions.

ROTEIRO FINAL: preencha roteiro com exatamente ${count} blocos. Roles: ${roles}. Cada fala é completa, natural e específica para a referência atual. O roteiro final tem prioridade sobre os moldes legados.

REGRA VISUAL: não repita na fala o que a câmera já mostra sem função narrativa.
REGRA DE RETENÇÃO: cada bloco deve avançar o anterior; não entregue o payoff cedo demais.
REGRA DE CTA: o CTA nasce da intenção + objetivo.
`;
  return `${SYSTEM_BASE}\n\n${directive}\n${buildVariantDirective(variant)}`;
}

/** Revisor de Roteiro do Blocos de venda — mesmo papel do Quality Judge do
 * pipeline principal (quality-judge.ts), mas julgando as FRASES FINAIS
 * MONTADAS como um roteiro só (não os campos isolados): gramática,
 * persuasão (cada bloco realmente convence, ou é só bonito?) e
 * direcionamento (os blocos formam um arco coerente — gancho →
 * desenvolvimento → CTA — ou parecem frases soltas coladas sem conexão?).
 * Reaproveita a mesma barra de qualidade criativa (CREATIVE_QUALITY_BAR) e
 * a mesma taxonomia de técnica por papel já usadas no prompt de geração,
 * em vez de duplicar critério novo. Genérico por variante — não assume
 * número fixo de blocos. */
const JudgmentSchema = z.object({
  naturalidade: z.number().min(0).max(10),
  especificidade: z.number().min(0).max(10),
  persuasao: z.number().min(0).max(10),
  direcionamento: z.number().min(0).max(10),
  weakestField: z.string(),
  revisionInstruction: z.string().nullable(),
});

const JUDGE_SYSTEM = `Você é o Revisor de Roteiro do Blocos de venda — não escreve nada, só avalia
com rigor as FALAS FINAIS do roteiro, exatamente como o usuário vai ler/falar, como um roteiro único
e contínuo, procurando motivo pra reprovar
texto mediano, clichê, robótico, gramaticalmente quebrado, ou que não persuade de verdade.

Você recebe os campos crus E as falas finais, em ordem. Julgue SEMPRE pela fala final e pelo arco completo. Os campos semânticos são evidência auxiliar; o roteiro livre é a saída principal.

${CREATIVE_QUALITY_BAR}

Técnica esperada por PAPEL (mesma taxonomia usada na geração — nem toda variante usa todos os
papéis, julgue só os que aparecerem nas frases montadas que você recebeu):
- Gancho (gancho): qualquer mecânica do repertório de hooks (curiosity, pattern_interrupt,
  identity_call, result_first etc.) — precisa realmente interromper o scroll, soar como fala
  natural (não copy de anúncio) e não cair na fórmula "Se você é X que valoriza Y...". Julgue se a
  escolha combina com o produto/foto, não se bateu uma técnica fixa.
- Revelação (produto+funcao): "${REVELACAO_TECNICA}" — a função tem que ser o benefício real desse
  produto.
- Dor (dor): "${DOR_TECNICA}" — dor específica e reconhecível, não genérica.
- Prova (prova): "${PROVA_TECNICA}" — detalhe concreto e verificável, nunca inventado.
- Alívio (fato+proposito): "${ALIVIO_TECNICA}" — fecha o arco emocional aberto na Dor.
- Benefício extra (beneficioExtra): "${BENEFICIO_EXTRA_TECNICA}" — um segundo benefício real,
  nunca repetição do que já foi dito em Revelação/Alívio.
- Objeção (objecao): "${OBJECAO_TECNICA}" — responde uma dúvida real e comum, nunca inventada.
- CTA (local): "${CTA_TECNICA}" — liga o CTA à mensagem inteira, não só ao produto solto.

Dê nota de 0 a 10 em 4 eixos:
- naturalidade: as frases MONTADAS soam como alguém falando de verdade em português correto, ou tem
  erro de concordância/verbo duplicado/preposição sobrando? Qualquer erro gramatical na frase
  montada derruba essa nota pra abaixo de 5, mesmo que o resto do texto esteja bom.
- especificidade: usa o produto/personagem REAL da foto, ou serviria pra qualquer produto do
  mesmo nicho?
- persuasao: cada bloco realmente aplica a técnica esperada do papel dele (acima) de um jeito que
  convenceria alguém de verdade, ou é só um enfeite de linguagem sem força persuasiva real?
- direcionamento: os blocos, lidos em sequência, formam UM arco coerente (o público do Gancho é o
  mesmo que sente a Dor e recebe o Alívio; o CTA fecha a mensagem do Gancho), ou parecem frases
  soltas coladas sem conexão entre si?

"weakestField": o nome do campo mais fraco (ex.: "fato", "dor").
"revisionInstruction": se QUALQUER eixo estiver abaixo de 8, escreva uma instrução CIRÚRGICA (o que
reescrever, em qual campo, por quê, citando a frase montada quebrada ou o ponto do arco que não
conecta) — senão, null.`;

async function judgeFields(fields: BlocosVendaFields, variant: BlocosVendaVariant) {
  const falasMontadas = checkFalaLengths(fields, variant)
    .map((c) => `Bloco ${c.bloco}: "${c.fala}"`)
    .join("\n");
  return callStructuredText({
    schema: JudgmentSchema,
    system: JUDGE_SYSTEM,
    prompt: `Campos gerados:\n${JSON.stringify(fields, null, 2)}\n\nFrases finais montadas (roteiro completo, leia em sequência):\n${falasMontadas}`,
    toolName: "blocos_venda_judgment",
  });
}

const REVISE_SYSTEM = `Você reescreve os campos de um gerador de vídeo de venda a partir de UMA
instrução cirúrgica de qualidade. Aplique a instrução só no(s) campo(s) indicado(s), mantendo os
outros campos exatamente como estão (inclusive os campos vazios "" que a variante atual não usa —
nunca preencha um campo que estava vazio, a menos que a instrução peça isso explicitamente). Nunca
invente característica, número ou prova do produto que não esteja nos campos já existentes. Retorne
os campos completos, no mesmo formato de entrada.`;

async function reviseFields(fields: BlocosVendaFields, instruction: string): Promise<BlocosVendaFields> {
  return callStructuredText({
    schema: FieldsSchema,
    system: REVISE_SYSTEM,
    prompt: `Campos atuais:\n${JSON.stringify(fields, null, 2)}\n\nInstrução de revisão:\n${instruction}`,
    toolName: "blocos_venda_fields",
  });
}

/** Junta as checagens determinísticas (duração + gramática/repetição) numa
 * só instrução — essas nunca dependem de julgamento de IA, só de regra e
 * fórmula em código, porque a LLM já demonstrou (na prática) não seguir
 * essas regras de forma confiável só por estarem escritas no prompt. */
function deterministicInstruction(fields: BlocosVendaFields, variant: BlocosVendaVariant): string | null {
  const checks = checkFalaLengths(fields, variant);
  const lengthIssues = checks
    .filter((c) => c.over)
    .map(
      (c) =>
        `Bloco ${c.bloco}: a fala tem ${c.chars} letras / ${c.words} palavras (~${c.secs.toFixed(0)}s) e passa do slot de 10s. Reescreva SOMENTE a fala desse bloco, preservando a ideia e os fatos, para aproximadamente 100–114 letras.`,
    );

  const underIssues = checks
    .filter((c) => c.under)
    .map(
      (c) =>
        `Bloco ${c.bloco}: a fala tem só ${c.chars} letras / ${c.words} palavras (~${c.secs.toFixed(0)}s). Elabore a mesma ideia com um detalhe REAL adicional, sem inventar fatos, até aproximadamente 95–114 letras.`,
    );

  const expectedRoles = CREATIVE_ROLES_BY_VARIANT[variant];
  const scriptIssues: string[] = [];
  if (fields.roteiro) {
    if (fields.roteiro.length !== expectedRoles.length) {
      scriptIssues.push(`O campo roteiro precisa ter exatamente ${expectedRoles.length} blocos, nos papéis: ${expectedRoles.join(", ")}.`);
    } else {
      fields.roteiro.forEach((block, index) => {
        if (block.role !== expectedRoles[index]) {
          scriptIssues.push(`O bloco ${index + 1} deve ter role "${expectedRoles[index]}", não "${block.role}".`);
        }
      });
    }
  }

  const intent = fields.strategy?.intent ?? "sales";
  const intentIssues = validateIntentSemantics(fields, intent);
  const structuralIssues = fields.roteiro?.length
    ? []
    : checkStructuralIssues(fields, variant);

  const all = [...lengthIssues, ...underIssues, ...scriptIssues, ...intentIssues, ...structuralIssues];
  return all.length ? all.join("\n") : null;
}

/** Analisa a(s) foto(s) do avatar+produto e devolve os campos do gerador já
 * preenchidos, pra variante de duração escolhida (padrão: "padrao", igual
 * ao comportamento de sempre). `contexto` é opcional — texto livre que o
 * usuário pode digitar pra dar informação que não dá pra ver na foto
 * (nome do produto se não estiver legível, público-alvo pretendido etc).
 *
 * Depois de gerar: (1) checagens determinísticas de duração/gramática em
 * código, (2) Quality Judge (mesma barra de qualidade criativa do resto do
 * KRONIA). Se algo reprovar, revisa — no máximo 2 rodadas (não um loop
 * aberto): a 1ª pega a maioria dos casos, a 2ª existe porque, na prática,
 * uma única revisão às vezes não corrige tudo de primeira. */
export async function generateBlocosVendaFields(
  imageDataUrls: string[],
  contexto?: string,
  variant: BlocosVendaVariant = "padrao",
): Promise<BlocosVendaFields> {
  const prompt = contexto?.trim()
    ? `Preencha os campos a partir desta foto. Contexto adicional dado pelo usuário (use pra completar o que a foto não mostra, mas não contradiga o que está visível): ${contexto.trim()}`
    : "Preencha os campos a partir desta foto.";

  let fields = await callStructuredVisionFromDataUrls({
    schema: FieldsSchema,
    system: buildSystem(variant),
    prompt,
    images: imageDataUrls,
    toolName: "blocos_venda_fields",
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const deterministic = deterministicInstruction(fields, variant);
    const judgment = attempt < 2 ? await judgeFields(fields, variant) : null;
    const instruction = [deterministic, judgment?.revisionInstruction].filter(Boolean).join("\n");
    if (!instruction) break;
    fields = await reviseFields(fields, instruction);
  }

  // Última garantia, sem IA: se mesmo depois de 2 revisões algum bloco
  // continuar passando de 10s, corta palavra por palavra em código — pedir
  // pra LLM encurtar de novo não é confiável o bastante (visto na prática:
  // ela às vezes ignora a instrução), e o usuário nunca deve ver o alerta
  // "passa de 10s" logo depois de gerar com IA.
  const finalChecks = checkFalaLengths(fields, variant);
  if (finalChecks.some((check) => check.over)) {
    // Se a escrita livre não respeitar o contrato mesmo após 3 revisões,
    // cai para o fallback determinístico. Segurança operacional vence uma
    // fala criativa estourada.
    const fallback = { ...fields, roteiro: undefined, strategy: undefined };
    return enforceFalaBudgets(fallback, variant);
  }

  return enforceFalaBudgets(fields, variant);
}
