import { z } from "zod";
import { callStructuredText, callStructuredVisionFromDataUrls } from "../../lib/openai";
import { HOOK_TYPES, PERSUASION_MECHANISMS } from "../../types/taxonomy";
import { BANNED_PHRASES } from "../compliance/absolute-claims-guard";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";
import { checkFalaLengths, checkStructuralIssues, enforceFalaBudgets } from "./blocos-venda-fala";

/**
 * Preenche os 14 campos do gerador de blocos de venda a partir da foto do
 * avatar/personagem com o produto — o usuário não digita nada, só anexa a
 * foto (e opcionalmente um contexto curto). Uma chamada de visão só, porque
 * os campos são interdependentes (o nome do personagem, o tom da voz e o
 * público entram todos na mesma frase-modelo) e ficam mais coerentes
 * escritos juntos do que emendados de 3 chamadas separadas.
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
});

export type BlocosVendaFields = z.infer<typeof FieldsSchema>;

/** Técnicas dos blocos 1–5, uma por linha — checadas contra a taxonomia real
 * do app (types/taxonomy.ts) em vez de string solta: se um desses nomes for
 * removido/renomeado na taxonomia, o build quebra aqui em vez de o prompt
 * silenciosamente citar uma técnica que não existe mais. */
function fromHookTypes(...names: (typeof HOOK_TYPES)[number][]): string {
  return names.join(" + ");
}
function fromMechanisms(...names: (typeof PERSUASION_MECHANISMS)[number][]): string {
  return names.join(" + ");
}
const BLOCO1_TECNICA = fromHookTypes("identity_call", "pattern_interrupt");
const BLOCO2_TECNICA = fromMechanisms("beneficio");
const BLOCO3_TECNICA = fromMechanisms("problema_solucao", "desejo");
const BLOCO4_TECNICA = fromMechanisms("alivio");
const BLOCO5_TECNICA = fromMechanisms("cta_claro");

const SYSTEM = `Você preenche os campos de um gerador de vídeos de venda de ~50s (5 blocos de 10s,
formato SCRIPT/CENA/CÂMERA/AÇÃO/FALA/VOZ) a partir de UMA foto: um personagem/avatar (pode ser
qualquer pessoa — Jesus, uma moça com blusa, um vendedor, tanto faz) segurando ou perto de um
produto. Sua tarefa é escrever os 14 campos abaixo, cada um pronto pra entrar direto nas frases-
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
- Cada bloco tem ~10s de fala (ritmo de leitura em voz alta: ~2,1 palavras/segundo). A FRASE
  FINAL de cada bloco (o texto pronto, já com os campos encaixados no template, não só o campo
  isolado) tem que caber em no máximo ~18 palavras no total — senão o bloco passa de 10s e alguém
  vai precisar encurtar na mão depois. Pense na frase inteira antes de escrever cada campo, não só
  no campo isolado.

TÉCNICA POR BLOCO — mesma taxonomia usada pelos outros agentes de copy do KRONIA (hooks validados
em análise de 34.635 clipes virais + mecanismos de persuasão legítimos, nunca manipulação
enganosa, escassez inventada ou prova social sem evidência). Escreva CADA campo já pensando na
técnica do bloco onde ele entra:
- publico + valores (bloco 1, gancho): técnica "${BLOCO1_TECNICA}" — chama o espectador pela
  identidade dele de um jeito específico o bastante pra interromper o scroll, não um público
  genérico ("as pessoas", "todo mundo").
- produto + funcao (bloco 2, revelação): mecanismo "${BLOCO2_TECNICA}" — a função emocional tem
  que ser o benefício real que ESSE produto entrega, nunca uma característica técnica solta.
- dor (bloco 3, uso + identificação): mecanismo "${BLOCO3_TECNICA}" — a dor tem que ser específica
  e reconhecível no dia a dia de quem é o público do bloco 1, não uma dor genérica.
- fato + proposito (bloco 4, experiência): mecanismo "${BLOCO4_TECNICA}" — o propósito é o
  alívio/ganho de longo prazo que resolve a dor do bloco 3, fechando o arco emocional dos 5 blocos.
- local (bloco 5, CTA): mecanismo "${BLOCO5_TECNICA}" — o CTA fica ligado à mensagem (não ao
  produto isolado) e sempre diz onde clicar.

SIGNIFICADO DE CADA CAMPO (como ele entra nas frases-modelo, pra você escrever no tom certo):
- nome: primeiro nome do personagem. Se a foto sugerir claramente uma figura bíblica/religiosa
  (túnica, iconografia cristã), use "Jesus". Senão, invente um nome coerente com a aparência (ex.:
  "Marina", "Rafael") — nunca deixe genérico tipo "Avatar". Vira "FALA — VOZ OFICIAL DE {NOME}:" e
  "{Nome} está sentado em...".
- publico: pra quem é o produto, entra em "Se você é {publico} que valoriza {valores}…". Ex.: "uma
  mulher", "um pai", "quem trabalha demais".
- valores: o que esse público valoriza, entra na mesma frase acima. Ex.: "sua fé, sua família e
  sua paz".
- produto: nome do produto COM ARTIGO (ex.: "o devocional Mulheres com Deus", "a caneca
  personalizada"). Entra em "está com {produto} nas mãos" e "Isso não é só {produto}… é {funcao}.".
- funcao: função emocional do produto, frase curta SEM ponto final. Entra em "é {funcao}.".
- dor: dor cotidiana do público, frase curta SEM ponto final. Entra em "Na correria da vida… às
  vezes {dor}.".
- fato: fato verificável e curto sobre o produto. SEM ponto final. Entra em "{fato} para
  {proposito}.".
- proposito: o que a pessoa ganha a longo prazo, frase curta SEM ponto final. Entra na mesma frase
  acima, junto com "fato".
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

Responda só com os 14 campos preenchidos, nada além disso.`;

/** Quality Judge pros 14 campos — mesmo papel do Quality Judge do pipeline
 * principal (quality-judge.ts): não escreve nada, só avalia com rigor
 * procurando motivo pra reprovar texto mediano/clichê/robótico. Reaproveita
 * a mesma barra (CREATIVE_QUALITY_BAR) em vez de duplicar critério novo. */
const JudgmentSchema = z.object({
  naturalidade: z.number().min(0).max(10),
  especificidade: z.number().min(0).max(10),
  weakestField: z.string(),
  revisionInstruction: z.string().nullable(),
});

const JUDGE_SYSTEM = `Você é o Quality Judge dos campos de um gerador de vídeo de venda —
não escreve nada, só avalia com rigor os 14 campos abaixo, procurando motivo pra reprovar texto
mediano, clichê ou robótico.

${CREATIVE_QUALITY_BAR}

Dê nota de 0 a 10 em 2 eixos:
- naturalidade: soa como alguém falando de verdade, ou como texto de propaganda de IA?
- especificidade: usa o produto/personagem REAL da foto, ou serviria pra qualquer produto do
  mesmo nicho?

"weakestField": o nome do campo mais fraco (ex.: "fato", "dor").
"revisionInstruction": se naturalidade OU especificidade estiver abaixo de 8, escreva uma
instrução CIRÚRGICA (o que reescrever, em qual campo, por quê) — senão, null.`;

async function judgeFields(fields: BlocosVendaFields) {
  return callStructuredText({
    schema: JudgmentSchema,
    system: JUDGE_SYSTEM,
    prompt: `Campos gerados:\n${JSON.stringify(fields, null, 2)}`,
    toolName: "blocos_venda_judgment",
  });
}

const REVISE_SYSTEM = `Você reescreve os campos de um gerador de vídeo de venda a partir de UMA
instrução cirúrgica de qualidade. Aplique a instrução só no(s) campo(s) indicado(s), mantendo os
outros campos exatamente como estão. Nunca invente característica, número ou prova do produto que
não esteja nos campos já existentes. Retorne os 14 campos completos, no mesmo formato de entrada.`;

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
function deterministicInstruction(fields: BlocosVendaFields): string | null {
  const overBlocks = checkFalaLengths(fields).filter((c) => c.over);
  const lengthIssues = overBlocks.map(
    (c) =>
      `Bloco ${c.bloco} (campo${c.campos.length > 1 ? "s" : ""} ${c.campos.join(" + ")}): a fala fica com ${c.words} palavras (~${c.secs.toFixed(0)}s), passa dos 10s do bloco. Reescreva ${c.campos.length > 1 ? "esses campos" : "esse campo"} mais curto(s) pra a fala do bloco ficar com no máximo 18 palavras no total (~10s), sem perder o sentido.`,
  );
  const structuralIssues = checkStructuralIssues(fields);
  const all = [...lengthIssues, ...structuralIssues];
  return all.length ? all.join("\n") : null;
}

/** Analisa a(s) foto(s) do avatar+produto e devolve os 14 campos do
 * gerador já preenchidos. `contexto` é opcional — texto livre que o
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
): Promise<BlocosVendaFields> {
  const prompt = contexto?.trim()
    ? `Preencha os 14 campos a partir desta foto. Contexto adicional dado pelo usuário (use pra completar o que a foto não mostra, mas não contradiga o que está visível): ${contexto.trim()}`
    : "Preencha os 14 campos a partir desta foto.";

  let fields = await callStructuredVisionFromDataUrls({
    schema: FieldsSchema,
    system: SYSTEM,
    prompt,
    images: imageDataUrls,
    toolName: "blocos_venda_fields",
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const deterministic = deterministicInstruction(fields);
    const judgment = attempt === 0 ? await judgeFields(fields) : null;
    const instruction = [deterministic, judgment?.revisionInstruction].filter(Boolean).join("\n");
    if (!instruction) break;
    fields = await reviseFields(fields, instruction);
  }

  // Última garantia, sem IA: se mesmo depois de 2 revisões algum bloco
  // continuar passando de 10s, corta palavra por palavra em código — pedir
  // pra LLM encurtar de novo não é confiável o bastante (visto na prática:
  // ela às vezes ignora a instrução), e o usuário nunca deve ver o alerta
  // "passa de 10s" logo depois de gerar com IA.
  return enforceFalaBudgets(fields);
}
