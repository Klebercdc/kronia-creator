import { z } from "zod";

/**
 * Anexo de uma mensagem — reaproveita os 2 caminhos que já existiam no
 * projeto, nenhum novo:
 * - imagem: data URL inline, mesmo padrão que `analyzeProductPhoto`/
 *   `analyzeActorPhoto` já usam (`readFileAsDataUrl` no cliente).
 * - vídeo: sobe pro bucket `creator-reference-videos` já existente (mesma
 *   função `uploadReferenceVideo` que o vídeo de referência usa), só o
 *   `storagePath` é guardado na mensagem.
 * Exatamente um dos dois (`dataUrl`/`storagePath`) vem preenchido conforme
 * o `type`.
 */
export const AttachmentSchema = z.object({
  type: z.enum(["image", "video"]),
  name: z.string(),
  mimeType: z.string(),
  dataUrl: z.string().nullable(),
  storagePath: z.string().nullable(),
  /** Preenchido pelo servidor (nunca pelo cliente) rodando o MESMO canal de
   * visão que já existe (`analyzeProductImage`, product-vision.ts) sobre o
   * `dataUrl` — a KRONIA de fato "vê" a imagem anexada, não só registra o
   * nome do arquivo. Null pra vídeo (sem canal de visão de vídeo na
   * conversa) ou enquanto a análise ainda não rodou. */
  visualDescription: z.string().nullable(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const ConversationMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  attachments: z.array(AttachmentSchema),
  /** Referência ao job do pipeline de Criação (creator_jobs.id) quando esta
   * mensagem representa "KRONIA acionou/entregou uma criação" — null pra
   * mensagens de conversa normal. */
  jobId: z.string().nullable(),
  createdAt: z.string(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;
