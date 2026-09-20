/**
 * Biblioteca temática ministerial — pro Teólogo (Jeová Fala) escolher
 * vocabulário e ângulo coerentes com o tema REAL da mensagem, em vez de um
 * prompt genérico de "fé" que faz mensagens de temas diferentes (consolo,
 * coragem, perdão...) saírem parecidas. O Teólogo não recebe um "tipo"
 * pré-classificado — essa tabela é referência que ele mesmo consulta pra
 * identificar o tema mais próximo do roteiro e usar o vocabulário certo,
 * nunca uma trava rígida (o tema real do roteiro sempre manda).
 *
 * Ordem canônica de raciocínio (regra do agente, não deste arquivo):
 * BÍBLIA → CONTEXTO → HERMENÊUTICA → VERDADE → NECESSIDADE HUMANA →
 * MINISTRAÇÃO — nunca "emoção bonita → versículo decorativo colado depois".
 */
export interface MinistryTheme {
  tema: string;
  subtemas: string[];
  vocabulario: string[];
}

export const MINISTRY_THEMES: MinistryTheme[] = [
  {
    tema: "Consolo",
    subtemas: ["luto", "perda", "solidão", "dor física ou emocional"],
    vocabulario: ["consolo", "refúgio", "descanso", "acolhimento", "presença"],
  },
  {
    tema: "Encorajamento",
    subtemas: ["desânimo", "cansaço", "vontade de desistir"],
    vocabulario: ["força", "ânimo", "coragem", "renovo", "persistência"],
  },
  {
    tema: "Esperança",
    subtemas: ["incerteza sobre o futuro", "situação sem saída aparente"],
    vocabulario: ["esperança", "promessa", "amanhã", "restauração", "luz"],
  },
  {
    tema: "Fé",
    subtemas: ["dúvida", "insegurança espiritual", "primeiros passos na fé"],
    vocabulario: ["fé", "confiança", "certeza", "caminhar por fé", "crer"],
  },
  {
    tema: "Perdão",
    subtemas: ["mágoa não resolvida", "dificuldade de perdoar", "culpa"],
    vocabulario: ["perdão", "libertação", "reconciliação", "graça", "leveza"],
  },
  {
    tema: "Paz interior",
    subtemas: ["ansiedade", "agitação mental", "sobrecarga"],
    vocabulario: ["paz", "quietude", "descanso", "tranquilidade", "sossego"],
  },
  {
    tema: "Propósito",
    subtemas: ["sensação de vazio", "falta de direção", "dúvida vocacional"],
    vocabulario: ["propósito", "chamado", "direção", "significado", "caminho"],
  },
  {
    tema: "Gratidão",
    subtemas: ["foco no que falta", "dificuldade de reconhecer bênçãos"],
    vocabulario: ["gratidão", "bênção", "reconhecimento", "contentamento"],
  },
  {
    tema: "Família",
    subtemas: ["conflito familiar", "criação dos filhos", "casamento"],
    vocabulario: ["lar", "união", "cuidado", "geração", "aliança"],
  },
  {
    tema: "Provisão",
    subtemas: ["dificuldade financeira", "medo de faltar"],
    vocabulario: ["provisão", "sustento", "suficiência", "cuidado"],
  },
  {
    tema: "Cura",
    subtemas: ["doença física", "ferida emocional", "recuperação"],
    vocabulario: ["cura", "restauração", "saúde", "renovo", "alívio"],
  },
  {
    tema: "Proteção",
    subtemas: ["medo", "sensação de vulnerabilidade", "ameaça real ou percebida"],
    vocabulario: ["proteção", "refúgio", "abrigo", "segurança", "guarda"],
  },
  {
    tema: "Recomeço",
    subtemas: ["erro passado", "vontade de mudar de vida", "nova fase"],
    vocabulario: ["recomeço", "nova chance", "renovação", "transformação"],
  },
  {
    tema: "Identidade",
    subtemas: ["comparação com outros", "baixa autoestima", "quem eu sou"],
    vocabulario: ["identidade", "valor", "propósito individual", "singularidade"],
  },
  {
    tema: "Sabedoria",
    subtemas: ["decisão difícil", "encruzilhada de vida"],
    vocabulario: ["sabedoria", "discernimento", "direção", "conselho"],
  },
  {
    tema: "Humildade",
    subtemas: ["orgulho", "dificuldade de pedir ajuda"],
    vocabulario: ["humildade", "mansidão", "simplicidade", "serviço"],
  },
  {
    tema: "Perseverança",
    subtemas: ["obstáculo prolongado", "espera longa", "provação"],
    vocabulario: ["perseverança", "resistência", "firmeza", "constância"],
  },
  {
    tema: "Amor ao próximo",
    subtemas: ["relacionamento difícil", "necessidade de compaixão"],
    vocabulario: ["amor", "compaixão", "empatia", "cuidado com o outro"],
  },
  {
    tema: "Gratidão pela graça",
    subtemas: ["mérito próprio vs. graça recebida", "sentimento de indignidade"],
    vocabulario: ["graça", "favor imerecido", "misericórdia", "dádiva"],
  },
  {
    tema: "Alegria",
    subtemas: ["tristeza prolongada", "busca por motivo de celebrar"],
    vocabulario: ["alegria", "gozo", "celebração", "contentamento"],
  },
  {
    tema: "Confiança em tempos de crise",
    subtemas: ["crise pessoal", "crise coletiva", "notícia ruim"],
    vocabulario: ["confiança", "sustento em meio à tempestade", "âncora"],
  },
  {
    tema: "Vocação/chamado",
    subtemas: ["dúvida sobre carreira", "sensação de estar fora do lugar certo"],
    vocabulario: ["chamado", "dons", "vocação", "missão pessoal"],
  },
  {
    tema: "Comunidade/igreja",
    subtemas: ["isolamento", "busca por pertencimento"],
    vocabulario: ["comunhão", "corpo", "irmandade", "pertencimento"],
  },
  {
    tema: "Oração",
    subtemas: ["dificuldade de orar", "sensação de oração não respondida"],
    vocabulario: ["oração", "clamor", "intimidade", "diálogo com Deus"],
  },
];
