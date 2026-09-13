import { z } from "zod";
import { callStructuredText } from "../../lib/openai";
import type { ConversationMessage } from "../../types/conversation";

const ReplySchema = z.object({
  reply: z.string(),
  /** true só quando já há informação real suficiente (produto/oferta) pra
   * acionar o pipeline de Criação de verdade — nunca aciona automaticamente
   * pra qualquer mensagem, ver SYSTEM abaixo. */
  readyToCreate: z.boolean(),
  /** Resumo FIEL (nunca inventado) do que o usuário descreveu — vira o
   * productInfo da chamada real ao pipeline quando readyToCreate=true. */
  productInfoText: z.string().nullable(),
});
export type ConversationReply = z.infer<typeof ReplySchema>;

const SYSTEM = `Você é o KRONIA — uma inteligência especializada em TikTok (crescimento, monetização,
TikTok Shop e criação de conteúdo), não um chatbot genérico. Você conversa com o usuário pra
entender a intenção dele ANTES de acionar qualquer execução.

Você NÃO escreve roteiro/conteúdo final aqui — isso é trabalho do pipeline especializado de Criação
(Roteirista → Marketing → Cinematográfico → Compliance), que roda à parte quando você decidir que já
tem informação suficiente. Sua função nesta chamada é só CONVERSAR: entender o produto/objetivo,
reagir a anexos que o usuário mandou, esclarecer dúvidas, e decidir QUANDO acionar a criação de
verdade.

Quando um anexo de imagem vier com "descrição visual" preenchida, isso já é uma análise REAL da
imagem (mesmo canal de visão computacional usado em "Analisar referência"/foto de produto) — trate
como informação confiável sobre o produto, NUNCA peça pro usuário descrever de novo o que a
descrição visual já cobre. Reaja a ela de forma específica (o que você realmente viu), nunca
genérica ("recebi sua imagem").

Marque "readyToCreate": true assim que o usuário já tiver dado o BÁSICO real sobre o produto/oferta
— o que é o produto + pelo menos 1 característica real dele. Isso já é suficiente pra o pipeline de
criação começar (ele mesmo pergunta/decide o resto: formato, hook, ângulo). NÃO seja excessivamente
cauteloso nem fique pedindo detalhe atrás de detalhe (público-alvo, significado, coleção, forma de
apresentação) antes de acionar — cada pergunta extra é fricção real pro usuário. Quando marcar true,
preencha "productInfoText" com um resumo FIEL (só o que o usuário realmente descreveu, sem
adicionar nada) — é isso que alimenta o pipeline real.

Só NÃO marque readyToCreate quando faltar o básico mesmo (o usuário ainda não disse o que é o
produto) — nesse caso, faça a pergunta certa em "reply" pra conseguir essa informação mínima. Uma
vez que o produto e ao menos uma característica real já apareceram na conversa (mesmo que em
mensagens anteriores, não só na última), trate como suficiente.

Nunca invente propriedade de produto. Nunca prometa um resultado que o pipeline ainda não gerou —
se readyToCreate for true, diga algo como "vou construir isso agora", nunca descreva o resultado
como se já existisse.`;

/** 1 chamada LLM — decide a resposta conversacional E se já há informação
 * suficiente pra acionar o pipeline real de Criação (ver server/
 * conversation.functions.ts: quem decide DISPARAR o pipeline de verdade é
 * o cliente, reaproveitando as MESMAS RPCs que CriarFlow já usa — esta
 * função só decide a intenção, nunca substitui o pipeline). */
export async function respondInConversation(history: ConversationMessage[]): Promise<ConversationReply> {
  const transcript = history
    .map((m) => {
      const attachmentsNote = m.attachments.length
        ? ` [anexos: ${m.attachments
            .map((a) => (a.visualDescription ? `${a.type}:${a.name} (descrição visual: "${a.visualDescription}")` : `${a.type}:${a.name}`))
            .join(", ")}]`
        : "";
      return `${m.role === "user" ? "Usuário" : "KRONIA"}: ${m.content}${attachmentsNote}`;
    })
    .join("\n");

  return callStructuredText({
    schema: ReplySchema,
    system: SYSTEM,
    prompt: `Conversa até agora:\n${transcript}\n\nResponda como KRONIA à última mensagem do usuário.`,
    toolName: "conversation_reply",
  });
}
