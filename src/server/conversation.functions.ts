import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createConversation,
  listConversations,
  getConversation,
  touchConversationTitle,
  touchConversation,
  listConversationMessages,
  addConversationMessage,
  getJob,
  type ConversationRow,
  type ConversationMessageRow,
} from "../lib/supabase";
import { AttachmentSchema, type Attachment } from "../types/conversation";
import { respondInConversation } from "../core/conversation/reply";
import { transcribeVoiceMessage } from "../core/conversation/voice";
import { analyzeProductImage } from "../core/generation/product-vision";
import type { RunPipelineResult } from "./pipeline.functions";

/** Roda o MESMO canal de visão computacional que "Analisar referência"/foto
 * de produto já usa (product-vision.ts) sobre cada anexo de imagem — a
 * conversa não só guarda a imagem, ela REALMENTE vê o que tem nela, uma
 * chamada por imagem (mantém a análise específica de cada anexo, em vez de
 * uma análise combinada que dilui qual imagem tinha o quê). */
async function withVisualAnalysis(attachments: Attachment[]): Promise<Attachment[]> {
  return Promise.all(
    attachments.map(async (a) => {
      if (a.type !== "image" || !a.dataUrl || a.visualDescription) return a;
      try {
        const visualDescription = await analyzeProductImage([a.dataUrl]);
        return { ...a, visualDescription };
      } catch {
        return a;
      }
    }),
  );
}

function toRowMessage(row: ConversationMessageRow) {
  return { ...row, attachments: row.attachments as unknown as Attachment[] };
}

/** Cria uma conversa vazia — não confundir com "seed do fluxo Criar": a
 * conversa é a entidade principal (ver types/conversation.ts), Criar é só
 * um pipeline que ela pode acionar quando fizer sentido. */
export const createConversationFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ConversationRow> => createConversation(),
);

export const listConversationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConversationRow[]> => listConversations(),
);

export const getConversationFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ conversationId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const conversation = await getConversation(data.conversationId);
    if (!conversation) return null;
    const messages = (await listConversationMessages(data.conversationId)).map(toRowMessage);
    return { conversation, messages };
  });

const SendMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string(),
  attachments: z.array(AttachmentSchema).default([]),
});

/**
 * Grava a mensagem do usuário, chama o agente de conversa (1 chamada LLM,
 * ver core/conversation/reply.ts) e grava a resposta do KRONIA. NÃO aciona
 * o pipeline de Criação aqui dentro — só devolve `readyToCreate`/
 * `productInfoText` pro cliente decidir disparar as MESMAS RPCs que
 * CriarFlow já usa (enqueueContentGeneration/advanceContentGenerationJob),
 * sem duplicar o pipeline nem o Job Engine.
 */
export const sendMessageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => SendMessageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const attachmentsWithVision = await withVisualAnalysis(data.attachments);

    const userMessage = toRowMessage(
      await addConversationMessage({
        conversationId: data.conversationId,
        role: "user",
        content: data.content,
        attachments: attachmentsWithVision,
      }),
    );

    const history = (await listConversationMessages(data.conversationId)).map(toRowMessage);
    const reply = await respondInConversation(history);

    const assistantMessage = toRowMessage(
      await addConversationMessage({
        conversationId: data.conversationId,
        role: "assistant",
        content: reply.reply,
      }),
    );

    await touchConversation(data.conversationId);

    // Título automático da conversa a partir da primeira mensagem do
    // usuário — só na primeira troca (history.length === 2: a mensagem que
    // acabou de ser gravada + a resposta ainda não conta nesse ponto).
    if (history.length === 1) {
      await touchConversationTitle(data.conversationId, data.content.slice(0, 60));
    }

    return {
      userMessage,
      assistantMessage,
      readyToCreate: reply.readyToCreate,
      productInfoText: reply.productInfoText,
    };
  });

/**
 * Chamada depois que o pipeline real (Job Engine) termina — grava o
 * resultado como mensagem do KRONIA na MESMA conversa, associando o job
 * (jobId) à mensagem. O resultado em si já existe em `creator_jobs.result`
 * (fonte única, sem duplicar dado) — aqui só referenciamos o id.
 */
export const appendConversationResultFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ conversationId: z.string().min(1), jobId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const job = await getJob(data.jobId);
    if (!job || job.status !== "succeeded") return null;

    const result = job.result as unknown as RunPipelineResult;
    const hook = result.output.generation.selectedHook;
    const content =
      result.status === "aprovado"
        ? `Pronto! Criei o roteiro completo. Hook: "${hook}". Dá uma olhada na aba Criar pra ver todas as cenas e o prompt pra gerar o vídeo.`
        : `Terminei o roteiro (hook: "${hook}"), mas o Compliance pediu revisão manual em alguns trechos — dá uma olhada na aba Criar pra ajustar antes de gerar o vídeo.`;

    const message = toRowMessage(
      await addConversationMessage({
        conversationId: data.conversationId,
        role: "assistant",
        content,
        jobId: data.jobId,
      }),
    );

    await touchConversation(data.conversationId);
    return message;
  });

export const transcribeVoiceMessageFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ audioBase64: z.string().min(1), mimeType: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const buffer = Buffer.from(data.audioBase64, "base64");
    const text = await transcribeVoiceMessage(buffer, data.mimeType);
    return { text };
  });
