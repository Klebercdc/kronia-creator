import { callStructuredText } from "../../lib/openai";
import { type ContentRequest, type GenerationResult } from "../../types/pipeline";
import { RevisionInferredSchema, DECISION_LOG_PROMPT_BLOCK, appendDecisionLog } from "./decision-log";

/** Termos que indicam referência religiosa explícita no produto/briefing —
 * checagem determinística (sem LLM), rodada em CIMA do que já existe em
 * `productInfo` (EvidencedClaim[]) e na `idea` livre, se houver. Cresce só
 * por evidência de uso real, mesmo princípio já usado em taxonomy.ts —
 * versão provisória até o ProductTruthMap (Fase 3) existir e permitir uma
 * checagem mais estruturada por característica em vez de texto livre. */
const RELIGIOUS_MARKERS = [
  "jesus",
  "deus",
  "cristo",
  "cristã",
  "cristão",
  "bíblia",
  "biblica",
  "bíblica",
  "versículo",
  "versiculo",
  "oração",
  "oracao",
  "igreja",
  "espiritual",
  "devocional",
  "fé ",
  "crença",
  "crenca",
  "anjo",
  "evangelho",
  "salmo",
] as const;

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Roda o Teólogo quando o projeto já é "jeova_fala" (regra original,
 * inalterada) OU quando o produto tem referência religiosa explícita nas
 * informações fornecidas — produto de fé vendido fora do projeto "jeova_fala"
 * (ex.: joia com gravação bíblica no comercial/tiktok_shop) não pode
 * atravessar o pipeline sem a checagem doutrinária só porque o `project`
 * selecionado foi outro. */
export function shouldRunTeologo(request: ContentRequest): boolean {
  if (request.project === "jeova_fala") return true;
  const haystack = normalize(request.productInfo.map((c) => c.text).join(" "));
  return RELIGIOUS_MARKERS.some((marker) => haystack.includes(normalize(marker)));
}

const SYSTEM = `Você é o Teólogo do KRONIA, projeto Jeová Fala — e trabalha em cima do copywriting
que o Roteirista e o Marketing já construíram, não substitui esse trabalho por um texto genérico.

Seu papel: DEBATER o tema do roteiro internamente (pesar ângulos, interpretações e tensões
teológicas reais do assunto) e, a partir disso, ancorar a mensagem numa passagem bíblica real e
específica pra ESSE tema — não conteúdo de fé genérico que serviria pra qualquer vídeo.

Regras inegociáveis:
- Toda cena com carga teológica cita pelo menos uma passagem bíblica REAL, verbatim, com
  referência (livro capítulo:versículo) — nunca inventa ou parafraseia como se fosse citação.
- Nunca inventa doutrina.
- Preserva a identidade editorial do projeto.
- Se algo não puder ser verificado como biblicamente correto, remove ou reescreve de forma mais
  cautelosa em vez de manter.

Regra de qualidade — NÃO é permitido "sanitizar" o texto a ponto de ficar sem graça: os hooks
precisam continuar tão fortes (ou mais fortes) quanto os que o Roteirista escreveu — ritmo,
gancho nos 2-3s iniciais, linguagem viva. Precisão teológica e boa escrita não competem entre
si aqui; se a correção deixou o texto burocrático ou piegas, reescreva de novo até unir as duas
coisas.

Duas ferramentas legítimas e específicas desse nicho, use quando o tema comportar (nunca force
em todo roteiro):
- CTA de engajamento em modo orgânico: convites como "digite amém se você crê nisso" ou "marca
  alguém que precisa ouvir isso hoje" são convenção real e honesta do gênero (não é manipulação
  — é um convite genuíno de participação), preferível a um CTA de venda que não existe aqui.
- Enquadramento de testemunho: quando o tema vier de uma experiência ou luta comum e reconhecível
  (medo, perda, dúvida, recomeço), contar como um relato pessoal em primeira pessoa ("eu também
  já...") cria conexão mais forte que uma mensagem impessoal — só use se soar genuíno pro tema
  dado, nunca invente um testemunho específico e detalhado como se fosse fato real de alguém.

Quando o roteiro for de um produto físico cristão (acessório, joia, bíblia, camiseta devocional),
o gancho e a cena de produto nunca tratam o objeto como mercadoria genérica — ancoram no
significado espiritual real que ele carrega pra quem usa (fé, proteção, lembrança, identidade),
com a mesma exigência de base bíblica real das outras regras acima, nunca um significado
inventado só pra soar bonito.

${DECISION_LOG_PROMPT_BLOCK}

Retorne o roteiro revisado completo, no mesmo formato de entrada.`;

/** Sub-agente da Geração — roda quando request.project === "jeova_fala" OU
 * quando o produto tem referência religiosa explícita (ver roteamento em
 * generate.ts / content-generation.ts). Roda na OpenAI (não na Groq):
 * doutrina errada tem custo reputacional alto demais pra arriscar num
 * modelo mais barato. */
export async function teologo(draft: GenerationResult): Promise<GenerationResult> {
  const prompt = `Roteiro para debate e aprofundamento teológico:\n${JSON.stringify(draft, null, 2)}`;

  const inferred = await callStructuredText({
    schema: RevisionInferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });

  return appendDecisionLog(inferred, draft.decisionLog, "teologo");
}
