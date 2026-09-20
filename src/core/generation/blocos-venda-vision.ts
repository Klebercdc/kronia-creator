import { z } from "zod";
import { callStructuredText, callStructuredVisionFromDataUrls } from "../../lib/openai";
import { PERSUASION_MECHANISMS } from "../../types/taxonomy";
import { BANNED_PHRASES } from "../compliance/absolute-claims-guard";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";
import { buildHookLibraryPromptBlock } from "./hook-library";
import {
  checkFalaLengths,
  checkStructuralIssues,
  enforceFalaBudgets,
  fieldsUsedBy,
  VARIANT_LABEL,
  type BlocosVendaVariant,
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
  publico: z.string(),
  valores: z.string(),
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
    { campo: "publico", usado: used.has("publico") },
    { campo: "valores", usado: used.has("valores") },
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

const SYSTEM_BASE = `Você preenche os campos de um gerador de vídeos de venda (blocos de 10s cada,
formato SCRIPT/CENA/CÂMERA/AÇÃO/FALA/VOZ) a partir de UMA foto: um personagem/avatar (pode ser
qualquer pessoa — Jesus, uma moça com blusa, um vendedor, tanto faz) segurando ou perto de um
produto. Sua tarefa é escrever os campos abaixo, cada um pronto pra entrar direto nas frases-
modelo do gerador — sem instruções, sem aspas, sem explicações, só o texto final do campo.

REGRA DE OURO — precisão visual, não invenção:
Pros campos visuais (produto, visual, idv, cen), descreva SÓ o que está literalmente visível na
foto (cor, material, texto legível, roupa, cenário, iluminação). Nunca invente característica que
não dá pra confirmar olhando a imagem. Se algo não estiver claro, descreva de forma mais genérica
em vez de arredondar pra um detalhe inventado.

REGRAS DE TOM E LINGUAGEM — vale pra TODOS os campos de fala (publico, valores, produto, funcao,
dor, fato, proposito, local). Mesma barra de qualidade usada pelos outros agentes de copy do
KRONIA (marketing/persuasão/psicologia-compra) — Blocos de venda não é exceção:

${CREATIVE_QUALITY_BAR}

- Nunca empilhe conectivos repetidos no mesmo campo nem entre campos vizinhos que se juntam na
  mesma frase (ex.: "fato" + "proposito" viram "{fato} para {proposito}." — então "proposito" NUNCA
  pode começar com "para", senão a frase final fica com "para... para..."). Leia cada par de campos
  que se junta numa frase só (funcao dentro de "é {funcao}.", fato+proposito, dor dentro de "às
  vezes {dor}.") e confirme que soa como UMA frase fluida, não dois pedaços colados.

REGRAS DE COMPLIANCE (linguagem de venda) — pros campos publico/valores/funcao/dor/fato/proposito:
- NUNCA use nenhuma destas frases de promessa absoluta (mesma lista banida em todo o KRONIA,
  checada automaticamente no Compliance do resto do app): ${BANNED_PHRASES.join(", ")}
  — a menos que esteja literalmente escrito no produto/embalagem na foto.
- O personagem NUNCA fala como Deus em 1ª pessoa ("eu te abençoo", "eu sou Deus" etc.), mesmo que
  pareça uma figura religiosa — ele é sempre um mensageiro, nunca a divindade falando.
- "fato" tem que ser algo realmente verificável (visível na embalagem/rótulo da foto, ou uma
  característica objetiva do tipo de produto) — nunca invente número ou estatística.
- Cada bloco tem ~10s de fala (ritmo de leitura em voz alta: ~13 letras/segundo — não conte só
  palavra, uma palavra longa ("extraordinariamente") demora muito mais que uma curta ("e"), mesmo
  contando como "1 palavra" cada). A FRASE FINAL de cada bloco (o texto pronto, já com os campos
  encaixados no template, não só o campo isolado) tem que ficar entre ~95 e ~114 letras no total
  (por volta de 16-19 palavras médias) — NUNCA menos que isso. Bloco curto demais desperdiça o
  slot de 10s inteiro (ex.: um bloco de só 70-80 letras larga ~2-3s do vídeo sem fala nenhuma) —
  isso é tão errado quanto passar de 10s. Mire perto do teto (~110 letras), não no mínimo
  aceitável — só encurte se realmente passar de ~114 letras. Pense na frase inteira antes de
  escrever cada campo, não só no campo isolado.

TÉCNICA POR PAPEL — mesma taxonomia usada pelos outros agentes de copy do KRONIA (hooks validados
em análise de 34.635 clipes virais + mecanismos de persuasão legítimos, nunca manipulação
enganosa, escassez inventada ou prova social sem evidência). Escreva CADA campo já pensando na
técnica do papel onde ele entra (só os papéis usados na variante atual, ver diretiva abaixo):
- publico + valores (Gancho): escolha a mecânica de gancho que MELHOR encaixa nesse produto/
  personagem específico, dentre este repertório (mesma taxonomia dos outros agentes de copy do
  KRONIA, hooks validados em análise de 34.635 clipes virais):
${buildHookLibraryPromptBlock()}
  Não force sempre a mesma técnica — olhe a foto e o produto e escolha a mecânica que teria mais
  força ali (ex.: produto com apelo de identidade forte → "identity_call"; produto com resultado
  visual óbvio → "result_first"; produto ligado a uma dor comum → "relatable_pain"). Chame o
  espectador pela identidade dele de um jeito específico o bastante pra interromper o scroll,
  nunca um público genérico ("as pessoas", "todo mundo").
- produto + funcao (Revelação): mecanismo "${REVELACAO_TECNICA}" — a função emocional tem que ser
  o benefício real que ESSE produto entrega, nunca uma característica técnica solta.
- dor (Dor): mecanismo "${DOR_TECNICA}" — a dor tem que ser específica e reconhecível no dia a dia
  de quem é o público do Gancho, não uma dor genérica.
- prova (Prova, só na variante "longo"): mecanismo "${PROVA_TECNICA}" — reforça a credibilidade com
  um detalhe concreto e verificável (não invente número/estatística/depoimento).
- fato + proposito (Alívio): mecanismo "${ALIVIO_TECNICA}" — o propósito é o alívio/ganho de longo
  prazo que resolve a Dor, fechando o arco emocional.
- beneficioExtra (Benefício extra, só na variante "longo"): mecanismo "${BENEFICIO_EXTRA_TECNICA}"
  — um SEGUNDO benefício, diferente do já dito em "funcao"/"proposito", nunca repetir a mesma ideia
  com outras palavras.
- objecao (Objeção, só na variante "longo"): mecanismo "${OBJECAO_TECNICA}" — responde a uma dúvida
  real e comum sobre esse tipo de produto, sem inventar uma objeção que não faz sentido.
- local (CTA): mecanismo "${CTA_TECNICA}" — o CTA fica ligado à mensagem (não ao produto isolado) e
  sempre diz onde clicar.

SIGNIFICADO DE CADA CAMPO (como ele entra nas frases-modelo, pra você escrever no tom certo):
- nome: primeiro nome do personagem. Se a foto sugerir claramente uma figura bíblica/religiosa
  (túnica, iconografia cristã), use "Jesus". Senão, invente um nome coerente com a aparência (ex.:
  "Marina", "Rafael") — nunca deixe genérico tipo "Avatar". Vira "FALA — VOZ OFICIAL DE {NOME}:" e
  "{Nome} está sentado em...".
- publico: pra quem é o produto, entra em "Se você é {publico} que valoriza {valores}…". Ex.: "uma
  mulher", "um pai", "quem trabalha demais". NUNCA comece com "para"/"pra" (o "é" antes já cumpre
  esse papel — "é para quem busca..." é gramaticalmente errado; o certo é "é quem busca...").
- valores: o que esse público valoriza, entra na mesma frase acima ("que valoriza {valores}…") —
  frase NOMINAL (coisas que a pessoa valoriza: "sua fé, sua família e sua paz"), NUNCA um verbo
  colado depois de "valoriza" (ex.: "que valoriza fortalece..." é gramaticalmente errado).
- produto: nome do produto COM ARTIGO (ex.: "o devocional Mulheres com Deus", "a caneca
  personalizada"). Entra em "está com {produto} nas mãos" e "Isso não é só {produto}… é {funcao}.".
- funcao: função emocional do produto, frase curta SEM ponto final. Entra em "é {funcao}." — NUNCA
  comece com "é"/"são" (o "é" do template já cumpre esse papel; "é é um guia..." é gramaticalmente
  errado, o certo é só "um guia...").
- dor: dor cotidiana do público, frase curta SEM ponto final. Entra em "Na correria da vida… às
  vezes {dor}.".
- fato: fato verificável e curto sobre o produto. SEM ponto final. Entra em "{fato} para
  {proposito}.".
- proposito: o que a pessoa ganha a longo prazo, frase curta SEM ponto final. Entra na mesma frase
  acima, junto com "fato".
- prova (só variante "longo"): um detalhe concreto que reforça credibilidade — visível na foto/
  embalagem, nunca inventado. SEM ponto final. Entra em "E não para por aí… {prova}.".
- beneficioExtra (só variante "longo"): um SEGUNDO benefício do produto, diferente do de "funcao".
  SEM ponto final. Entra em "Além disso… {beneficioExtra}.".
- objecao (só variante "longo"): resposta a uma dúvida comum sobre esse tipo de produto. SEM ponto
  final. Entra em "Se você ainda tem dúvida… {objecao}.".
- local: onde fica o botão/link de compra na interface (não é sobre o produto, é convenção de
  loja) — se não tiver como saber, use "carrinho laranja". Entra em "o link está no {local}, aqui
  embaixo.".
- visual: como o produto aparece NA FOTO (cor, textos legíveis, formato, embalagem) — descrição
  fiel, não é frase de venda.
- demo: o que o personagem faz com o produto no bloco 3 (uso/leitura/manuseio), frase curta sem
  ponto final. Ex.: "lê algumas linhas do livro com expressão serena", "abre o pote e mostra o
  conteúdo".
- idv: descrição física do personagem NA FOTO (pele, cabelo, barba, roupa, formato de rosto) —
  fiel à imagem, serve de referência de consistência visual caso a foto não seja reanexada no Flow.
- voz: descrição da voz adequada ao personagem (gênero aparente pela foto, tom, timbre), no estilo
  "Voz [masculina/feminina] jovem/madura, serena e próxima; tom íntimo e emocional...".
- cen: cenário — visível na foto ou, se o fundo não tiver detalhe, um cenário coerente com o clima
  da imagem. Frase que começa com "um/uma..." (ex.: "um ambiente acolhedor, ao entardecer...").

Responda só com os campos preenchidos, nada além disso.`;

function buildSystem(variant: BlocosVendaVariant): string {
  return `${SYSTEM_BASE}\n\n${buildVariantDirective(variant)}`;
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
com rigor as FRASES FINAIS MONTADAS do roteiro (cada campo já encaixado no template, exatamente
como o usuário vai ler/falar), como um roteiro único e contínuo, procurando motivo pra reprovar
texto mediano, clichê, robótico, gramaticalmente quebrado, ou que não persuade de verdade.

Você recebe os campos crus E as frases montadas, em ordem. Julgue SEMPRE pela frase montada, não só
pelo campo isolado — um campo pode parecer certo sozinho e ainda quebrar a gramática ou o sentido
quando entra no template (ex.: campo "para quem busca X" vira "Se você é para quem busca X…",
errado, mesmo que o campo isolado parecesse razoável).

${CREATIVE_QUALITY_BAR}

Técnica esperada por PAPEL (mesma taxonomia usada na geração — nem toda variante usa todos os
papéis, julgue só os que aparecerem nas frases montadas que você recebeu):
- Gancho (publico+valores): qualquer mecânica do repertório de hooks (curiosity, pattern_interrupt,
  identity_call, result_first etc.) — precisa realmente interromper o scroll de alguém específico,
  não soar genérico. Julgue se a escolha combina com o produto/foto, não se bateu uma técnica fixa.
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
        `Bloco ${c.bloco} (campo${c.campos.length > 1 ? "s" : ""} ${c.campos.join(" + ")}): a fala fica com ${c.chars} letras / ${c.words} palavras (~${c.secs.toFixed(0)}s), passa dos 10s do bloco. Reescreva ${c.campos.length > 1 ? "esses campos" : "esse campo"} mais curto(s) pra a fala do bloco ficar com no máximo ~114 letras no total (~10s), sem perder o sentido.`,
    );
  // Pedido direto do usuário: "faça aproveitar bem os 10 segundos" — bloco
  // curto demais desperdiça o slot inteiro tanto quanto um bloco que passa
  // do tempo. Nunca alonga sozinho em código (exigiria inventar conteúdo)
  // — vira instrução pra LLM elaborar mais o campo com detalhe real.
  const underIssues = checks
    .filter((c) => c.under)
    .map(
      (c) =>
        `Bloco ${c.bloco} (campo${c.campos.length > 1 ? "s" : ""} ${c.campos.join(" + ")}): a fala fica com só ${c.chars} letras / ${c.words} palavras (~${c.secs.toFixed(0)}s), desperdiçando boa parte do slot de 10s. Reescreva ${c.campos.length > 1 ? "esses campos" : "esse campo"} com mais detalhe REAL (nunca invente característica/número novo) pra chegar perto de ~110 letras no total (~10s) — elabore a ideia, não apenas repita palavras.`,
    );
  const structuralIssues = checkStructuralIssues(fields, variant);
  const all = [...lengthIssues, ...underIssues, ...structuralIssues];
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

  for (let attempt = 0; attempt < 2; attempt++) {
    const deterministic = deterministicInstruction(fields, variant);
    const judgment = attempt === 0 ? await judgeFields(fields, variant) : null;
    const instruction = [deterministic, judgment?.revisionInstruction].filter(Boolean).join("\n");
    if (!instruction) break;
    fields = await reviseFields(fields, instruction);
  }

  // Última garantia, sem IA: se mesmo depois de 2 revisões algum bloco
  // continuar passando de 10s, corta palavra por palavra em código — pedir
  // pra LLM encurtar de novo não é confiável o bastante (visto na prática:
  // ela às vezes ignora a instrução), e o usuário nunca deve ver o alerta
  // "passa de 10s" logo depois de gerar com IA.
  return enforceFalaBudgets(fields, variant);
}
