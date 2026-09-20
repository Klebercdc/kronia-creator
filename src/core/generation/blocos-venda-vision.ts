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
  creativeRolesForVariant,
  VARIANT_LABEL,
  type BlocosVendaVariant,
  validateIntentSemantics,
  CREATIVE_ROLES_BY_VARIANT,
} from "./blocos-venda-fala";

/**
 * Preenche os campos do gerador criativo a partir da foto do
 * avatar/personagem com o produto — o usuário anexa a
 * foto (e opcionalmente um contexto curto). Uma chamada de visão só, porque
 * os campos são interdependentes (o nome do personagem, o tom da voz e o
 * público entram todos na mesma frase-modelo) e ficam mais coerentes
 * escritos juntos do que emendados de 3 chamadas separadas. 3 dos 17 campos
 * (prova/beneficioExtra/objecao) só são usados na variante "longo".
 */

const FieldsSchema = z.object({
  nome: z.string(),
  gancho: z.string(),
  produto: z.string().min(1),
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
function buildVariantDirective(variant: BlocosVendaVariant, intent: "message" | "engagement" | "sales" | "script" | "custom" = "custom"): string {
  const used = fieldsUsedBy(variant, intent);
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
  return `VARIANTE ATUAL: "${VARIANT_LABEL[variant]}". A estratégia define quais campos de fala são realmente usados.
Se strategy.intent for "sales", preencha somente os campos comerciais usados nesta variante: ${usados.join(", ")}.
Se strategy.intent for "message", "engagement", "script" ou "custom", NÃO preencha "local", "cta", "prova",
"beneficioExtra" ou "objecao" só para completar o schema; deixe esses campos vazios quando não forem fatos
necessários. O roteiro é a fonte criativa principal. Nunca invente conteúdo para campos não utilizados.
Os campos visuais/de personagem (nome, visual, demo, idv, voz, cen) continuam disponíveis para continuidade.`;
}

const SYSTEM_BASE = `Você é o motor criativo do KRONIA Creator.

HIERARQUIA OBRIGATÓRIA:
1. BRIEFING CRIATIVO explícito do usuário: define intenção, objetivo, tema, público, tom e direção.
2. IMAGEM: define identidade visual, personagem, produto, cenário e características observáveis.
3. CONTEXTO ADICIONAL: complementa o briefing somente quando não contradiz a imagem.
4. MOLDES LEGADOS DE VENDA: são apenas fallback técnico. Nunca substituem uma intenção explícita.

INTENÇÃO:
- message = reflexão, emoção, fé, esperança, consolo ou aplicação; sem CTA de compra.
- engagement = interação, comentário, compartilhamento, salvamento ou conexão.
- sales = venda/conversão; CTA comercial somente quando o briefing pedir ou quando a intenção for explicitamente sales.
- script = narrativa audiovisual.
- custom = seguir o briefing.

EVIDÊNCIA:
Não invente números, prova social, depoimentos, eficácia, resultados, preço, promoção ou características não verificáveis.
Linguagem criativa pode ser criada, mas não pode ser apresentada como fato.
Em conteúdo cristão, o personagem NÃO fala como Deus em primeira pessoa.

FIDELIDADE À IDENTIDADE E AO PRODUTO:
- "nome" é a identidade do personagem/avatar, NÃO o tema, a mensagem, a emoção ou o produto. Nunca use nomes como "Mensagem de Esperança", "Esperança", "Palavra de Conforto" ou equivalentes como se fossem personagem.
- Se o BRIEFING identificar explicitamente o personagem, preserve esse nome exatamente.
- Se o BRIEFING não identificar o personagem e a imagem não permitir uma identificação inequívoca, use "Personagem" em vez de inventar uma identidade.
- "produto" é o objeto/produto real mostrado ou explicitamente citado. Preserve seu nome literal.
- Nunca transforme o nome do personagem em tema ("Mensagem de Esperança") nem o produto em conceito emocional ("palavra de conforto", "palavra de esperança").
- Se o nome do produto estiver legível na imagem, transcreva-o literalmente, respeitando palavras e ordem.
- Se não estiver legível, use uma descrição objetiva do objeto, como "livro devocional", e não invente um nome comercial.
- Nunca use artigo indefinido + conceito abstrato ("uma palavra de conforto", "um momento de esperança") no campo produto.

ROTEIRO:
O campo roteiro é a saída criativa principal. Cada fala deve ser completa, natural e específica para esta chamada.
Não monte frases por fragmentos nem force um molde comercial quando o briefing pedir outra intenção.

Use somente os dados desta chamada. Nunca carregue contexto, produto, CTA, nome, claim ou cenário de outra geração.
Não exponha cadeia de pensamento privada.
Retorne somente os campos do schema.`;

function buildSystem(variant: BlocosVendaVariant): string {
  const count = expectedCreativeBlockCount(variant);

  const directive = `PROTOCOLO CRIATIVO — execute antes de escrever:
1. OBSERVE: separe evidência visual de instrução textual.
2. CONTEXTUALIZE: leia primeiro o BRIEFING CRIATIVO desta chamada.
3. INTENÇÃO: derive a intenção do briefing; NÃO assuma sales quando o briefing pedir mensagem, reflexão, fé, esperança, consolo ou engajamento.
4. OBJETIVO: derive o comportamento desejado a partir da intenção.
5. OPORTUNIDADE: encontre o melhor elemento narrativo/visual para essa intenção.
6. IDEIA: defina tema, verdade central, tensão e arco.
7. ESTRATÉGIA: escolha a mecânica adequada à intenção.
8. ESCRITA: escreva cada fala completa, natural e específica.
9. VALIDAÇÃO: confira intenção, claims, CTA, personagem, produto, timing e continuidade.

DECISÃO ESTRUTURADA:
Preencha strategy com intent, objective, theme, coreTruth, audience, emotionalStart, emotionalEnd, hookMechanic, narrativeArc, ctaObjective, verifiedFacts, observedVisuals e creativeAssumptions.

ROTEIRO FINAL:
Preencha roteiro com exatamente ${count} blocos. Os papéis dependem da intenção: em "sales" use papéis comerciais; em "message", "engagement", "script" ou "custom" use papéis narrativos e termine em "fechamento", nunca em "cta".
O roteiro é a saída principal e tem prioridade sobre os moldes legados.

REGRA CRÍTICA DE INTENÇÃO:
Se o BRIEFING pedir mensagem, reflexão, devocional, fé, esperança, consolo ou conteúdo semelhante sem pedir venda:
- strategy.intent deve ser "message";
- strategy.ctaObjective deve ser "none", "reflect", "share", "save" ou "comment", conforme o briefing;
- NÃO use carrinho, link de compra, comprar, adquirir, preço, promoção ou aquisição;
- NÃO invente prova social ou resultados;
- o encerramento deve concluir a mensagem ou convidar a uma ação não comercial coerente.

Se o BRIEFING pedir explicitamente venda, compra ou conversão, use "sales".

REGRA PARA PERSONAGEM E FALA:
- O personagem é quem aparece na cena; o tema não vira nome de personagem.
- Não escreva falas divinas em primeira pessoa como "eu te abençoo", "eu sou Deus", "eu vou te guiar" ou equivalentes.
- A mensagem deve ser narrada pelo personagem como mensageiro, sem atribuir autoridade divina literal.
- Não transforme uma mensagem sobre esperança em um personagem chamado "Mensagem de Esperança".

REGRA DE PRODUTO:
Se houver produto visível ou citado, preserve sua identidade literal. Nunca transforme o produto em um conceito emocional.

Não exponha cadeia de pensamento privada. Retorne somente o schema.`;

  return `${SYSTEM_BASE}\n\n${directive}\n${buildVariantDirective(variant, "custom")}`;
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

const JUDGE_SYSTEM = `Você é um revisor de roteiro criativo.
Avalie as FALAS FINAIS como um roteiro único e contínuo.
A estratégia estruturada recebida é a autoridade semântica: NÃO presuma que todo roteiro precisa vender.

${CREATIVE_QUALITY_BAR}

CRITÉRIOS:
- naturalidade: português falado, fluido e sem erros;
- especificidade: usa o personagem, produto e contexto reais desta chamada;
- persuasao: mede força da comunicação para a intenção atual, não força de venda;
- direcionamento: cada bloco avança o arco definido pela intenção.

REGRA DE INTENÇÃO:
Se strategy.intent for "message", não penalize a ausência de CTA comercial e não sugira compra, carrinho, link, preço ou promoção.
Se strategy.intent for "engagement", avalie o convite à interação.
Se strategy.intent for "sales", avalie o CTA comercial de acordo com o objetivo.
Se o personagem for Jesus ou outra figura religiosa, rejeite fala em primeira pessoa com autoridade divina.

Não sugira alegações, números, prova social ou resultados que não estejam nos dados.
Se qualquer eixo estiver abaixo de 8, escreva uma instrução CIRÚRGICA para a revisão; caso contrário, null.`;

async function judgeFields(fields: BlocosVendaFields, variant: BlocosVendaVariant) {
  const falasMontadas = checkFalaLengths(fields, variant)
    .map((c) => `Bloco ${c.bloco}: "${c.fala}"`)
    .join("\n");
  return callStructuredText({
    schema: JudgmentSchema,
    system: JUDGE_SYSTEM,
    prompt: `INTENÇÃO: ${fields.strategy?.intent ?? "custom"}\nOBJETIVO: ${fields.strategy?.objective ?? "custom"}\n\nCampos gerados:\n${JSON.stringify(fields, null, 2)}\n\nFrases finais montadas (roteiro completo, leia em sequência):\n${falasMontadas}`,
    toolName: "blocos_venda_judgment",
  });
}

const REVISE_SYSTEM = `Você reescreve campos de um gerador de roteiro criativo a partir de UMA instrução cirúrgica.
Preserve todos os campos não indicados.
Preserve a strategy.intent e o objetivo da chamada.
Nunca transforme uma intenção "message", "engagement" ou "script" em venda.
Nunca introduza carrinho, link, preço, promoção, compra ou aquisição em intenção não comercial.
Nunca invente característica, número, prova social, depoimento ou resultado.
Em conteúdo cristão, nunca escreva o personagem como autoridade divina em primeira pessoa.
Retorne os campos completos no mesmo formato de entrada.`;

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
  const intent = fields.strategy?.intent ?? "custom";
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

  const expectedRoles = creativeRolesForVariant(variant, intent);
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
    const fallback = { ...fields, roteiro: undefined };
    return enforceFalaBudgets(fallback, variant);
  }

  return enforceFalaBudgets(fields, variant);
}
