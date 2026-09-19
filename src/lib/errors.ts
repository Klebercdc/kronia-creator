/** Extrai uma mensagem legível de um erro capturado em catch — não confia só
 * em `instanceof Error`: erros lançados no servidor e serializados de volta
 * pro cliente por uma server function (RPC do TanStack Start) costumam
 * chegar como um objeto plano (JSON), não uma instância real de Error, então
 * `err instanceof Error` falha silenciosamente e cai num fallback genérico
 * mesmo quando `err.message` tem a causa real (visto na prática: "Algo deu
 * errado: Erro desconhecido" pra um erro que tinha mensagem real vinda do
 * servidor, ex. falha do yt-dlp baixando um vídeo do TikTok). */
export function errorMessageOf(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}
