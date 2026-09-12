import { callStructuredText } from "../../../lib/openai";
import { SemanticTruthCheckSchema, type CreativeSpec, type SemanticTruthCheck } from "./schemas";

const SYSTEM = `Você é o Semantic Product Truth Validator do KRONIA — a última linha de defesa contra uma
claim que não foi escrita literalmente, mas é DEMONSTRADA pela cena.

Você recebe: (1) características do produto marcadas "não confirmadas" (nunca podem ser afirmadas
NEM demonstradas), (2) características confirmadas (podem aparecer), (3) o conteúdo visual real que
vai ser executado (ações dos shots, direção, diálogo).

Sua única pergunta: a cena descrita, mesmo sem citar a palavra da característica não confirmada,
está PROVANDO visualmente que ela é verdade?

Isso inclui, mas não se limita a:
- ação física que só faz sentido se a propriedade for verdadeira (ex.: produto sendo jogado/
  derrubado e "saindo intacto" quando resistência a impacto é desconhecida);
- produto submerso/molhado/na chuva continuando a funcionar quando impermeabilidade é desconhecida;
- alguém "se sentindo melhor/curado/aliviado" por causa do produto quando efeito terapêutico é
  desconhecido;
- qualquer resultado visual (reação de personagem, estado final do produto, texto na tela) que só
  faz sentido como prova da característica não confirmada;
- eufemismo genérico ("depois de um teste", "após ser testado") cujo contexto deixa claro qual
  propriedade está sendo testada.

NÃO acuse ações neutras que não implicam a propriedade (ex.: mostrar o produto numa mesa, girar o
produto pra mostrar cor/textura, alguém segurando o produto normalmente). O objetivo é pegar a
CLAIM disfarçada, não qualquer ação genérica remotamente relacionada ao tema.

Se houver negação explícita e real (a cena diz que NÃO vai mostrar/testar a propriedade, e o
restante da cena realmente não demonstra nada disso), não é violação.

Liste em "violatedProperties" só os termos que realmente vieram da lista de não confirmadas
(nunca invente uma nova).`;

/**
 * Semantic Product Truth Validation — 1 chamada LLM (callStructuredText,
 * OpenAI), só quando `productTruth.unknown` não está vazio (controle de
 * custo: sem característica desconhecida, não há o que julgar
 * semanticamente). Complementa o QC determinístico (qc.ts) — nunca
 * substitui, nunca decide/altera productTruth.
 */
export async function checkSemanticProductTruth(spec: CreativeSpec): Promise<SemanticTruthCheck> {
  if (spec.productTruth.unknown.length === 0) {
    return { violatesProductTruth: false, violatedProperties: [], explanation: "Nenhuma característica não confirmada a verificar." };
  }

  const narratedContent = [
    ...spec.shotPattern.shots.map((s, i) => `Shot ${i + 1} [${s.durationSeconds}s]: ${s.action} (câmera: ${s.camera})`),
    spec.directorSpec.framing ? `Enquadramento: ${spec.directorSpec.framing}` : null,
    spec.directorSpec.environment ? `Ambiente: ${spec.directorSpec.environment}` : null,
    spec.directorSpec.continuityNotes ? `Continuidade: ${spec.directorSpec.continuityNotes}` : null,
    spec.dialogueSpec?.hasDialogue && spec.dialogueSpec.lines ? `Diálogo: ${spec.dialogueSpec.lines.join(" / ")}` : null,
    spec.imageSpec?.composition ? `Composição (imagem): ${spec.imageSpec.composition}` : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join("\n");

  const prompt = `Características NÃO confirmadas (nunca podem ser afirmadas nem demonstradas):
${JSON.stringify(spec.productTruth.unknown)}

Características confirmadas (podem aparecer normalmente):
${JSON.stringify(spec.productTruth.confirmed.map((c) => c.text))}

Conteúdo visual real que vai ser executado:
${narratedContent}

Esse conteúdo demonstra visualmente alguma característica não confirmada, mesmo sem citar o termo literal?`;

  return callStructuredText({
    schema: SemanticTruthCheckSchema,
    system: SYSTEM,
    prompt,
    toolName: "semantic_product_truth",
  });
}
