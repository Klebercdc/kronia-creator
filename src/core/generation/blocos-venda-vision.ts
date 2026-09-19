import { z } from "zod";
import { callStructuredVisionFromDataUrls } from "../../lib/openai";
import { HOOK_TYPES, PERSUASION_MECHANISMS } from "../../types/taxonomy";
import { BANNED_PHRASES } from "../compliance/absolute-claims-guard";

/**
 * Preenche os 14 campos do gerador de blocos de venda a partir da foto do
 * avatar/personagem com o produto — o usuário não digita nada, só anexa a
 * foto (e opcionalmente um contexto curto). Uma chamada de visão só, porque
 * os campos são interdependentes (o nome do personagem, o tom da voz e o
 * público entram todos na mesma frase-modelo) e ficam mais coerentes
 * escritos juntos do que emendados de 3 chamadas separadas.
 */

const FieldsSchema = z.object({
  nome: z.string(),
  publico: z.string(),
  valores: z.string(),
  produto: z.string(),
  funcao: z.string(),
  dor: z.string(),
  fato: z.string(),
  proposito: z.string(),
  local: z.string(),
  visual: z.string(),
  demo: z.string(),
  idv: z.string(),
  voz: z.string(),
  cen: z.string(),
});

export type BlocosVendaFields = z.infer<typeof FieldsSchema>;

/** Técnicas dos blocos 1–5, uma por linha — checadas contra a taxonomia real
 * do app (types/taxonomy.ts) em vez de string solta: se um desses nomes for
 * removido/renomeado na taxonomia, o build quebra aqui em vez de o prompt
 * silenciosamente citar uma técnica que não existe mais. */
function fromHookTypes(...names: (typeof HOOK_TYPES)[number][]): string {
  return names.join(" + ");
}
function fromMechanisms(...names: (typeof PERSUASION_MECHANISMS)[number][]): string {
  return names.join(" + ");
}
const BLOCO1_TECNICA = fromHookTypes("identity_call", "pattern_interrupt");
const BLOCO2_TECNICA = fromMechanisms("beneficio");
const BLOCO3_TECNICA = fromMechanisms("problema_solucao", "desejo");
const BLOCO4_TECNICA = fromMechanisms("alivio");
const BLOCO5_TECNICA = fromMechanisms("cta_claro");

const SYSTEM = `Você preenche os campos de um gerador de vídeos de venda de ~50s (5 blocos de 10s,
formato SCRIPT/CENA/CÂMERA/AÇÃO/FALA/VOZ) a partir de UMA foto: um personagem/avatar (pode ser
qualquer pessoa — Jesus, uma moça com blusa, um vendedor, tanto faz) segurando ou perto de um
produto. Sua tarefa é escrever os 14 campos abaixo, cada um pronto pra entrar direto nas frases-
modelo do gerador — sem instruções, sem aspas, sem explicações, só o texto final do campo.

REGRA DE OURO — precisão visual, não invenção:
Pros campos visuais (produto, visual, idv, cen), descreva SÓ o que está literalmente visível na
foto (cor, material, texto legível, roupa, cenário, iluminação). Nunca invente característica que
não dá pra confirmar olhando a imagem. Se algo não estiver claro, descreva de forma mais genérica
em vez de arredondar pra um detalhe inventado.

REGRAS DE TOM E LINGUAGEM — vale pra TODOS os campos de fala (publico, valores, produto, funcao,
dor, fato, proposito, local):
- Escreva como alguém fala de verdade em voz alta, não como texto de anúncio. Português falado,
  natural, direto — não português de propaganda genérica.
- PROIBIDO clichê de marketing solto ("milhões de porções/unidades/clientes satisfeitos", "número 1
  em vendas", "transforma sua vida", "experiência única") a menos que esteja literalmente escrito
  na embalagem da foto. Se não tem certeza olhando a imagem, não force um número ou superlativo —
  descreva o produto com as palavras mais simples e concretas possíveis.
- Nunca empilhe conectivos repetidos no mesmo campo nem entre campos vizinhos que se juntam na
  mesma frase (ex.: "fato" + "proposito" viram "{fato} para {proposito}." — então "proposito" NUNCA
  pode começar com "para", senão a frase final fica com "para... para..."). Leia cada par de campos
  que se junta numa frase só (funcao dentro de "é {funcao}.", fato+proposito, dor dentro de "às
  vezes {dor}.") e confirme que soa como UMA frase fluida, não dois pedaços colados.
- Frases curtas e concretas. Prefira uma imagem/sensação real a uma alegação abstrata.

REGRAS DE COMPLIANCE (linguagem de venda) — pros campos publico/valores/funcao/dor/fato/proposito:
- NUNCA use nenhuma destas frases de promessa absoluta (mesma lista banida em todo o KRONIA,
  checada automaticamente no Compliance do resto do app): ${BANNED_PHRASES.join(", ")}
  — a menos que esteja literalmente escrito no produto/embalagem na foto.
- O personagem NUNCA fala como Deus em 1ª pessoa ("eu te abençoo", "eu sou Deus" etc.), mesmo que
  pareça uma figura religiosa — ele é sempre um mensageiro, nunca a divindade falando.
- "fato" tem que ser algo realmente verificável (visível na embalagem/rótulo da foto, ou uma
  característica objetiva do tipo de produto) — nunca invente número ou estatística.
- Cada campo de fala fica curto (a frase final onde ele entra tem no máximo ~20 palavras).

TÉCNICA POR BLOCO — mesma taxonomia usada pelos outros agentes de copy do KRONIA (hooks validados
em análise de 34.635 clipes virais + mecanismos de persuasão legítimos, nunca manipulação
enganosa, escassez inventada ou prova social sem evidência). Escreva CADA campo já pensando na
técnica do bloco onde ele entra:
- publico + valores (bloco 1, gancho): técnica "${BLOCO1_TECNICA}" — chama o espectador pela
  identidade dele de um jeito específico o bastante pra interromper o scroll, não um público
  genérico ("as pessoas", "todo mundo").
- produto + funcao (bloco 2, revelação): mecanismo "${BLOCO2_TECNICA}" — a função emocional tem
  que ser o benefício real que ESSE produto entrega, nunca uma característica técnica solta.
- dor (bloco 3, uso + identificação): mecanismo "${BLOCO3_TECNICA}" — a dor tem que ser específica
  e reconhecível no dia a dia de quem é o público do bloco 1, não uma dor genérica.
- fato + proposito (bloco 4, experiência): mecanismo "${BLOCO4_TECNICA}" — o propósito é o
  alívio/ganho de longo prazo que resolve a dor do bloco 3, fechando o arco emocional dos 5 blocos.
- local (bloco 5, CTA): mecanismo "${BLOCO5_TECNICA}" — o CTA fica ligado à mensagem (não ao
  produto isolado) e sempre diz onde clicar.

SIGNIFICADO DE CADA CAMPO (como ele entra nas frases-modelo, pra você escrever no tom certo):
- nome: primeiro nome do personagem. Se a foto sugerir claramente uma figura bíblica/religiosa
  (túnica, iconografia cristã), use "Jesus". Senão, invente um nome coerente com a aparência (ex.:
  "Marina", "Rafael") — nunca deixe genérico tipo "Avatar". Vira "FALA — VOZ OFICIAL DE {NOME}:" e
  "{Nome} está sentado em...".
- publico: pra quem é o produto, entra em "Se você é {publico} que valoriza {valores}…". Ex.: "uma
  mulher", "um pai", "quem trabalha demais".
- valores: o que esse público valoriza, entra na mesma frase acima. Ex.: "sua fé, sua família e
  sua paz".
- produto: nome do produto COM ARTIGO (ex.: "o devocional Mulheres com Deus", "a caneca
  personalizada"). Entra em "está com {produto} nas mãos" e "Isso não é só {produto}… é {funcao}.".
- funcao: função emocional do produto, frase curta SEM ponto final. Entra em "é {funcao}.".
- dor: dor cotidiana do público, frase curta SEM ponto final. Entra em "Na correria da vida… às
  vezes {dor}.".
- fato: fato verificável e curto sobre o produto. SEM ponto final. Entra em "{fato} para
  {proposito}.".
- proposito: o que a pessoa ganha a longo prazo, frase curta SEM ponto final. Entra na mesma frase
  acima, junto com "fato".
- local: onde fica o botão/link de compra na interface (não é sobre o produto, é convenção de
  loja) — se não tiver como saber, use "carrinho laranja". Entra em "o link está no {local}, aqui
  embaixo.".
- visual: como o produto aparece NA FOTO (cor, textos legíveis, formato, embalagem) — descrição
  fiel, não é frase de venda.
- demo: o que o personagem faz com o produto no bloco 3 (uso/leitura/manuseio), frase curta sem
  ponto final. Ex.: "lê algumas linhas do livro com expressão serena", "abre o pote e mostra o
  conteúdo".
- idv: descrição física do personagem NA FOTO (pele, cabelo, barba, roupa, formato de rosto) —
  fiel à imagem, serve de referência de consistência visual caso a foto não seja reanexada no Flow.
- voz: descrição da voz adequada ao personagem (gênero aparente pela foto, tom, timbre), no estilo
  "Voz [masculina/feminina] jovem/madura, serena e próxima; tom íntimo e emocional...".
- cen: cenário — visível na foto ou, se o fundo não tiver detalhe, um cenário coerente com o clima
  da imagem. Frase que começa com "um/uma..." (ex.: "um ambiente acolhedor, ao entardecer...").

Responda só com os 14 campos preenchidos, nada além disso.`;

/** Analisa a(s) foto(s) do avatar+produto e devolve os 14 campos do
 * gerador já preenchidos. `contexto` é opcional — texto livre que o
 * usuário pode digitar pra dar informação que não dá pra ver na foto
 * (nome do produto se não estiver legível, público-alvo pretendido etc). */
export async function generateBlocosVendaFields(
  imageDataUrls: string[],
  contexto?: string,
): Promise<BlocosVendaFields> {
  const prompt = contexto?.trim()
    ? `Preencha os 14 campos a partir desta foto. Contexto adicional dado pelo usuário (use pra completar o que a foto não mostra, mas não contradiga o que está visível): ${contexto.trim()}`
    : "Preencha os 14 campos a partir desta foto.";

  return callStructuredVisionFromDataUrls({
    schema: FieldsSchema,
    system: SYSTEM,
    prompt,
    images: imageDataUrls,
    toolName: "blocos_venda_fields",
  });
}
