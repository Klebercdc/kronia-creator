import OpenAI, { toFile } from "openai";

/**
 * Transcreve uma mensagem de voz da Conversa — diferente de
 * `core/ingestion/whisper.ts` (que extrai áudio de um VÍDEO via ffmpeg
 * antes de transcrever), aqui o áudio já vem pronto do microfone do
 * navegador (webm/ogg), então não precisa de ffmpeg nem de arquivo
 * temporário em disco — vai direto da memória pro Whisper da OpenAI (mesma
 * chave/provider único do resto do pipeline).
 */
export async function transcribeVoiceMessage(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";

  const transcription = await client.audio.transcriptions.create({
    file: await toFile(audioBuffer, `voice-message.${ext}`),
    model: "whisper-1",
  });

  return transcription.text.trim();
}
