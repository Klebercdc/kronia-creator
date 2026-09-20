import type { HookType } from "../../types/taxonomy";

/**
 * Repertório de mecânicas de hook nomeadas, agrupadas pelas categorias já
 * fechadas em HOOK_TYPES (types/taxonomy.ts) — não cria taxonomia nova, só
 * dá ao Roteirista exemplos concretos de CADA categoria pra escolher/
 * combinar, em vez de reinventar o hook do zero a cada chamada (o que deixa
 * a qualidade mais sujeita a variação entre gerações). Cada entrada é um
 * padrão de abertura, não uma frase pronta — o conteúdo real vem sempre do
 * produto/tema atual, nunca copiado daqui.
 */
export interface HookMechanic {
  tipo: HookType;
  nome: string;
  padrao: string;
}

export const HOOK_LIBRARY: HookMechanic[] = [
  { tipo: "curiosity", nome: "Curiosity gap", padrao: "Abre uma lacuna de informação que só se fecha assistindo até o fim — nunca revela o essencial no hook." },
  { tipo: "curiosity", nome: "Segredo revelado", padrao: "\"Ninguém te conta isso sobre X\" — promete um conhecimento específico que o público não tem." },
  { tipo: "curiosity", nome: "Enigma visual", padrao: "A imagem do hook não faz sentido sozinha até a explicação aparecer depois." },
  { tipo: "pattern_interrupt", nome: "Corte seco inesperado", padrao: "Quebra abrupta de cena/ação logo no início, sem transição suave — força reprocessamento." },
  { tipo: "pattern_interrupt", nome: "Contradição direta", padrao: "Começa afirmando o oposto do que o público espera ouvir sobre o tema." },
  { tipo: "pattern_interrupt", nome: "Quebra de 4ª parede", padrao: "Personagem interrompe a própria ação pra falar direto com a câmera, fora do fluxo esperado." },
  { tipo: "bold_statement", nome: "Afirmação polarizadora", padrao: "Declaração forte o bastante pra gerar concordância ou discordância imediata — nunca vaga." },
  { tipo: "bold_statement", nome: "Ataque a uma crença comum", padrao: "Desafia diretamente um senso comum ('todo mundo acha que X, mas...')." },
  { tipo: "question", nome: "Pergunta que incomoda", padrao: "Pergunta que o espectador não consegue não responder mentalmente — específica, não genérica." },
  { tipo: "question", nome: "Pergunta retórica invertida", padrao: "Pergunta cuja resposta óbvia é o oposto do que o público faria — gera autorreflexão." },
  { tipo: "social_proof", nome: "Testemunho em aberto", padrao: "Começa no meio de um relato real ('...foi assim que mudou pra mim'), sem contexto prévio, forçando o espectador a se situar." },
  { tipo: "social_proof", nome: "Número de pessoas", padrao: "Abre com quantidade real e verificável de pessoas que passaram pela mesma situação." },
  { tipo: "before_after", nome: "Corte direto resultado→origem", padrao: "Mostra o resultado final primeiro, depois volta pra explicar como chegou lá." },
  { tipo: "before_after", nome: "Comparação lado a lado", padrao: "Antes e depois no mesmo frame ou em corte imediato, sem espaço pra dúvida visual." },
  { tipo: "negative_hook", nome: "Erro comum exposto", padrao: "Aponta um erro específico e reconhecível que o público comete sem perceber." },
  { tipo: "negative_hook", nome: "Aviso direto", padrao: "\"Pare de fazer X\" ou \"Você está fazendo Y errado\" — nomeia o problema antes da solução." },
  { tipo: "relatable_pain", nome: "Cena do cotidiano reconhecível", padrao: "Situação tão específica do dia a dia que o público se vê nela imediatamente." },
  { tipo: "relatable_pain", nome: "Frustração nomeada", padrao: "Nomeia em voz alta uma frustração que o público sente mas raramente verbaliza." },
  { tipo: "story_open", nome: "In medias res", padrao: "Começa no meio de uma cena de ação/tensão, sem introdução — contexto vem depois." },
  { tipo: "story_open", nome: "Gancho temporal", padrao: "\"3 dias atrás eu...\" — ancora no tempo pra criar expectativa de desfecho." },
  { tipo: "result_first", nome: "Resultado nos 2s", padrao: "Mostra o produto/resultado final logo no frame 1, sem preâmbulo — maior retenção isolada." },
  { tipo: "result_first", nome: "Prova em mãos", padrao: "Produto/resultado físico já em quadro, sendo manuseado, desde o primeiro segundo." },
  { tipo: "identity_call", nome: "Chamado direto de identidade", padrao: "\"Se você é [identidade específica]...\" — nomeia um grupo reconhecível, nunca genérico." },
  { tipo: "identity_call", nome: "Sinal de reconhecimento", padrao: "Descreve um comportamento/hábito tão específico de um grupo que só quem pertence a ele reconhece." },
  { tipo: "number_stat", nome: "Estatística de abertura", padrao: "Número real e verificável logo na primeira frase — nunca estimado ou arredondado pra soar melhor." },
  { tipo: "number_stat", nome: "Contagem regressiva", padrao: "Estrutura em lista numerada decrescente, criando expectativa de chegar ao item 1." },
];

/** Bloco de prompt pronto — agrupa por categoria pra ficar legível na
 * instrução do Roteirista, sem repetir o "tipo" em cada linha. */
export function buildHookLibraryPromptBlock(): string {
  const byType = new Map<HookType, HookMechanic[]>();
  for (const m of HOOK_LIBRARY) {
    if (!byType.has(m.tipo)) byType.set(m.tipo, []);
    byType.get(m.tipo)!.push(m);
  }
  return Array.from(byType.entries())
    .map(([tipo, mecanicas]) => `- ${tipo}: ${mecanicas.map((m) => `"${m.nome}" (${m.padrao})`).join(" | ")}`)
    .join("\n");
}
