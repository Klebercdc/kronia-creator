import type { ActorProfile } from "../../types/pipeline";

/**
 * Ator principal fixo do projeto Jeová Fala. Referência visual e de voz
 * definida pelo usuário — travada aqui pra não precisar redigitar em cada
 * geração e pra garantir que todo vídeo use exatamente a mesma descrição.
 */
export const JESUS_KRONIA: ActorProfile = {
  name: "Jesus",
  voiceDescription:
    "Voz masculina jovem, serena e próxima. Tom íntimo e emocional, natural e humano, " +
    "transmitindo compaixão e segurança. Fala calma, sem pressa, com pausas naturais. A voz " +
    "deve soar como uma conversa particular, não como uma pregação ou discurso. Timbre quente, " +
    "suave e levemente grave, com presença e profundidade, mas sem soar artificial ou " +
    "excessivamente grave. Dicção clara e natural, português brasileiro fluente. A interpretação " +
    "deve transmitir acolhimento, paz, esperança e autoridade tranquila. Evitar teatralidade, " +
    "dramatização excessiva, tom de locutor, voz épica ou voz de trailer.",
  appearanceDescription:
    "Homem adulto de aparência semítica, historicamente plausível, natural e humano. Pele " +
    "morena/oliva natural, com textura realista de pele humana. Rosto masculino adulto, " +
    "harmonioso e expressivo, sem aparência de modelo. Cabelos longos, castanho-escuros, " +
    "ondulados e volumosos, caindo naturalmente ao redor dos ombros e do rosto, levemente " +
    "desalinhados pelo vento, sem penteado artificial. Barba cheia castanho-escura, natural e " +
    "relativamente longa, acompanhando o formato do rosto, com alguns fios mais claros discretos; " +
    "bigode integrado naturalmente à barba. Sobrancelhas espessas e naturais. Olhos " +
    "castanho-escuros, profundos, expressivos e acolhedores; olhar sereno, compassivo e humano, " +
    "sem parecer teatral. Nariz masculino de proporções naturais, compatível com aparência " +
    "semítica. Maçãs do rosto discretamente marcadas. Lábios naturais, expressão tranquila. " +
    "Pequenas imperfeições naturais no rosto, evitando aparência retocada ou artificial. " +
    "Expressão predominantemente serena, compassiva, acolhedora e contemplativa — em cenas de " +
    "sofrimento, olhar de tristeza e profunda compreensão, nunca desespero; em cenas de " +
    "esperança, alívio, paz e confiança, com sorriso extremamente discreto quando apropriado. " +
    "Aparência geral cinematográfica, realista e fotográfica. NUNCA europeu, loiro, de olhos " +
    "azuis ou com aparência idealizada. NUNCA estilo de pintura religiosa, estátua, desenho, " +
    "fantasia ou personagem de videogame. Preservar o mesmo rosto, estrutura facial, cabelo, " +
    "barba e identidade visual em todos os clipes.",
};

export const ACTOR_PRESETS: ActorProfile[] = [JESUS_KRONIA];
