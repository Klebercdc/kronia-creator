/**
 * `Error.message` não é uma propriedade enumerável (padrão da linguagem) —
 * `JSON.stringify(new Error("x"))` devolve "{}", perdendo a mensagem. Isso
 * quebra silenciosamente qualquer erro lançado numa server function do
 * TanStack Start: o RPC serializa o erro pra mandar de volta pro cliente,
 * a mensagem real evapora nessa serialização, e o cliente recebe um objeto
 * vazio — mesmo com `errorMessageOf()` (lib/errors.ts) tratando isso do
 * lado do cliente, não tem mensagem nenhuma sobrando pra extrair (raiz do
 * bug real: "Erro desconhecido" voltando mesmo depois do fix client-side).
 *
 * Fix: dar a todo Error um `toJSON()` (JSON.stringify chama automaticamente
 * se existir) devolvendo message/name como propriedades normais. Import só
 * por efeito colateral — precisa rodar uma vez em cada processo servidor,
 * antes de qualquer server function lançar erro; importado no topo de cada
 * arquivo em server/*.functions.ts (são os pontos de entrada que o Nitro
 * empacota por rota, garantindo que o polyfill entra no bundle certo).
 */
if (!("toJSON" in Error.prototype)) {
  Object.defineProperty(Error.prototype, "toJSON", {
    value: function toJSON(this: Error) {
      return { name: this.name, message: this.message, stack: this.stack };
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
