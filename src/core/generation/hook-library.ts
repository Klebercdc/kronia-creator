import type { HookType } from "../../types/taxonomy";

/**
 * Repertório de mecânicas de hook nomeadas, agrupadas pelas categorias já
 * fechadas em HOOK_TYPES. Cada entrada é um padrão de abertura, não uma
 * frase pronta: o conteúdo real sempre vem do produto ou tema atual.
 */
export interface HookMechanic {
  tipo: HookType;
  nome: string;
  padrao: string;
}

export const HOOK_LIBRARY: HookMechanic[] = [
  { tipo: "curiosity", nome: "Curiosity gap", padrao: "Abre uma lacuna de informação que só se fecha assistindo até o fim — nunca revela o essencial no hook." },
  { tipo: "curiosity", nome: "Segredo revelado", padrao: "Ninguém te conta isso sobre X — promete um conhecimento específico que o público não tem." },
  { tipo: "curiosity", nome: "Enigma visual", padrao: "A imagem do hook não faz sentido sozinha até a explicação aparecer depois." },
  { tipo: "pattern_interrupt", nome: "Corte seco inesperado", padrao: "Quebra abrupta de cena ou ação logo no início, sem transição suave." },
  { tipo: "pattern_interrupt", nome: "Contradição direta", padrao: "Começa afirmando o oposto do que o público espera ouvir sobre o tema." },
  { tipo: "pattern_interrupt", nome: "Quebra de quarta parede", padrao: "Personagem interrompe a ação para falar diretamente com a câmera." },
  { tipo: "bold_statement", nome: "Afirmação polarizadora", padrao: "Declaração específica e forte o bastante para gerar reação imediata." },
  { tipo: "bold_statement", nome: "Ataque a uma crença comum", padrao: "Desafia diretamente um senso comum sobre o tema." },
  { tipo: "question", nome: "Pergunta que incomoda", padrao: "Pergunta específica que o espectador responde mentalmente." },
  { tipo: "question", nome: "Pergunta retórica invertida", padrao: "Pergunta cuja resposta óbvia contrasta com o comportamento comum do público." },
  { tipo: "social_proof", nome: "Testemunho em aberto", padrao: "Começa no meio de um relato real, sem contexto prévio." },
  { tipo: "social_proof", nome: "Número de pessoas", padrao: "Abre com quantidade real e verificável de pessoas na mesma situação." },
  { tipo: "before_after", nome: "Resultado para origem", padrao: "Mostra o resultado final primeiro e depois explica como chegou lá." },
  { tipo: "before_after", nome: "Comparação lado a lado", padrao: "Antes e depois no mesmo frame ou em corte imediato." },
  { tipo: "negative_hook", nome: "Erro comum exposto", padrao: "Aponta um erro específico e reconhecível que o público comete sem perceber." },
  { tipo: "negative_hook", nome: "Aviso direto", padrao: "Nomeia o comportamento problemático antes de apresentar a solução." },
  { tipo: "relatable_pain", nome: "Cena cotidiana reconhecível", padrao: "Situação específica do dia a dia na qual o público se reconhece." },
  { tipo: "relatable_pain", nome: "Frustração nomeada", padrao: "Verbaliza uma frustração específica que o público já sente." },
  { tipo: "story_open", nome: "In medias res", padrao: "Começa no meio de uma ação ou tensão; o contexto vem depois." },
  { tipo: "story_open", nome: "Gancho temporal", padrao: "Ancora o início em um momento concreto para criar expectativa de desfecho." },
  { tipo: "result_first", nome: "Resultado nos primeiros segundos", padrao: "Mostra o produto ou resultado final já no primeiro frame." },
  { tipo: "result_first", nome: "Prova em mãos", padrao: "Produto ou resultado físico aparece sendo manuseado desde o início." },
  { tipo: "identity_call", nome: "Chamado direto de identidade", padrao: "Nomeia um grupo específico e reconhecível logo na abertura." },
  { tipo: "identity_call", nome: "Sinal de reconhecimento", padrao: "Descreve um comportamento específico que só o grupo reconhece." },
  { tipo: "number_stat", nome: "Estatística de abertura", padrao: "Número real e verificável logo na primeira frase." },
  { tipo: "number_stat", nome: "Contagem regressiva", padrao: "Estrutura numerada decrescente que cria expectativa pelo item final." },
];

export function buildHookLibraryPromptBlock(): string {
  const byType = new Map<HookType, HookMechanic[]>();
  for (const mechanic of HOOK_LIBRARY) {
    if (!byType.has(mechanic.tipo)) byType.set(mechanic.tipo, []);
    byType.get(mechanic.tipo)!.push(mechanic);
  }
  return Array.from(byType.entries())
    .map(([tipo, mechanics]) => `- ${tipo}: ${mechanics.map((mechanic) => `"${mechanic.nome}" (${mechanic.padrao})`).join(" | ")}`)
    .join("\n");
}
