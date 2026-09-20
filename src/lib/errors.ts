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
  return `${fallback} ${diagnose(err)}`;
}

/** Nenhum dos 3 formatos conhecidos bateu — em vez de só devolver o
 * fallback genérico (que já mostrou 4 vezes seguidas não dar pista
 * nenhuma de causa real), anexa um resumo bruto do que `err` de fato é,
 * pra a PRÓPRIA tela de erro virar o diagnóstico da próxima ocorrência
 * sem precisar de DevTools/console do celular. Best-effort — nunca lança
 * (um erro dentro do tratamento de erro seria pior que o problema original). */
function diagnose(err: unknown): string {
  try {
    const ctor = err === null ? "null" : err === undefined ? "undefined" : (err as object)?.constructor?.name ?? typeof err;
    const keys = err && typeof err === "object" ? Object.keys(err).join(",") || "(sem chaves próprias)" : "";
    let dump = "";
    try {
      dump = JSON.stringify(err) ?? "(stringify -> undefined)";
    } catch {
      dump = "(não serializável)";
    }
    return `[diag: tipo=${ctor}${keys ? ` chaves=${keys}` : ""} json=${dump.slice(0, 200)}]`;
  } catch {
    return "[diag: falhou até o diagnóstico]";
  }
}
