import { z } from "zod";
import { callStructuredText } from "../../lib/openai";

/** Gancho narrativo — cada um puxa uma cena de abertura diferente, mas
 * todos seguem a mesma metodologia (ver SYSTEM abaixo): abertura crítica
 * em primeira pessoa, lista explícita do que NÃO mostrar, e revelação do
 * produto travada na imagem de referência. */
export const HOOK_TYPES = {
  entrega: "Motoboy/entregador toca a campainha e entrega o pacote na porta",
  provador: "Puxa a cortina do provador revelando o look já vestido",
  achado_escondido: "Abre a mochila ou bolsa e \"acha\" o produto lá dentro, como se tivesse esquecido",
  correio: "Pega o pacote na caixa de correio ou na portaria do prédio",
} as const;

export type HookType = keyof typeof HOOK_TYPES;

const SYSTEM = `Você escreve prompts de vídeo pro Google Flow/Veo, na metodologia de "gancho narrativo em
POV estrito" — a mesma técnica usada por criadoras avançadas de TikTok Shop pra prender atenção nos
primeiros segundos. A estrutura sempre tem essas partes, nessa ordem:

1. ABERTURA CRÍTICA: define exatamente o primeiro frame do vídeo — nunca "ela caminha até", sempre
   o vídeo já começa no meio da ação (ex: a mão já abrindo a porta, a cortina já sendo puxada).
2. LISTA DO QUE NÃO MOSTRAR: várias instruções explícitas de "NÃO mostrar X" cobrindo os erros mais
   prováveis do modelo de vídeo (mostrar preparação, mudar de plano pra terceira pessoa, mostrar o
   celular na mão, cortar antes da revelação) — a negação explícita trava mais o resultado do que só
   instrução positiva.
3. SEQUÊNCIA: a ação central acontecendo passo a passo, sempre em POV primeira pessoa, câmera
   levando o tremor natural de mão segurando o celular (não travada tipo tripé).
4. TRAVA DE IDENTIDADE DO PRODUTO: instrução clara que o produto/peça deve ficar 100% idêntico à
   imagem de referência enviada — cor, textura, costura, proporção — sem redesenhar.
5. ESTILO UGC AUTÊNTICO: luz natural, ambiente doméstico real, imperfeições de câmera (foco reajustando,
   leve tremor), sem parecer produção profissional.

Escreva SEMPRE em português, no mesmo registro técnico/direto do briefing (frases curtas, maiúsculas
pra ênfase nas instruções críticas, como "NÃO mostrar"). O resultado é o prompt final pronto pra colar
no Flow — não uma explicação sobre o prompt.`;

const HookPromptSchema = z.object({
  prompt: z.string(),
});

export interface GenerateHookPromptInput {
  /** Ação de cada movimento clicado na Biblioteca de Movimentos, na ordem
   * escolhida — é o material bruto que a IA costura na sequência do gancho
   * (não é texto livre digitado pela usuária, vem dos cliques). */
  movementActions: string[];
  hookType: HookType;
  subjectType: "person" | "product";
  totalDurationSec?: number;
}

export async function generateHookPrompt(input: GenerateHookPromptInput): Promise<string> {
  const { movementActions, hookType, subjectType, totalDurationSec } = input;
  const subjectLine =
    subjectType === "person"
      ? "Sujeito: uma pessoa real usando/mostrando o produto, mesma identidade da foto de referência."
      : "Sujeito: só o produto e as mãos que o seguram, sem necessariamente mostrar o rosto da pessoa.";

  const sequenceList = movementActions.map((a, i) => `${i + 1}. ${a}`).join("\n");

  const prompt = `Gancho de abertura: ${HOOK_TYPES[hookType]}
${subjectLine}
${totalDurationSec ? `Duração alvo: ~${totalDurationSec} segundos.` : ""}

Movimentos que a usuária escolheu, na ordem que devem acontecer DEPOIS do gancho de abertura (use
esses como a parte 3 — SEQUÊNCIA — da metodologia, adaptando a linguagem pro estilo do prompt, sem
inventar movimento que não esteja na lista nem pular nenhum):
${sequenceList}

Escreva o prompt completo seguindo a metodologia descrita, encaixando o gancho de abertura antes
desses movimentos.`;

  const result = await callStructuredText({
    schema: HookPromptSchema,
    system: SYSTEM,
    prompt,
    toolName: "hook_avancado_prompt",
  });

  return result.prompt;
}
