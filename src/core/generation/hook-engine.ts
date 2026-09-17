import type { ContentRequest } from "../../types/pipeline";

export type HookFamily =
  | "curiosity" | "problem" | "result" | "pattern_interrupt" | "discovery"
  | "pov" | "before_after" | "reveal" | "proof" | "comparison"
  | "confession" | "contrarian" | "identity" | "list" | "demo"
  | "story" | "objection" | "cta_bridge" | "emotional" | "number";

export interface HookPattern {
  id:number;
  family:HookFamily;
  mechanisms:string[];
  formula:string;
  visualDirective:string;
  bestFor:string[];
}

const FAMILIES:Array<{family:HookFamily; mechanisms:string[]; formulas:string[]; visual:string; bestFor:string[]}> = [
 {family:"curiosity",mechanisms:["curiosidade","open_loop"],formulas:[
  "Abra uma dúvida específica e responda só no payoff.","Comece pelo detalhe incomum e adie a explicação.",
  "Apresente duas possibilidades e revele a diferença depois.","Mostre o problema e esconda por segundos o mecanismo da solução.",
  "Faça uma pergunta específica cuja resposta dependa do produto/tema."],visual:"O elemento que cria a dúvida já aparece no primeiro frame.",bestFor:["vender","engajar","tiktok_shop","organico","comercial"]},
 {family:"problem",mechanisms:["problema_solucao","identificacao"],formulas:[
  "Nomeie uma situação incômoda concreta.","Mostre uma consequência observável e abra a causa.",
  "Interrompa uma rotina exatamente quando o problema aparece.","Comece no ponto de maior fricção do público.","Mostre o erro antes de explicar a correção."],visual:"Comece no momento exato do problema, não em uma introdução.",bestFor:["vender","tiktok_shop","organico","comercial"]},
 {family:"result",mechanisms:["resultado","curiosidade"],formulas:[
  "Mostre primeiro o resultado observável e depois o caminho.","Comece pela transformação visualmente verificável.",
  "Mostre o benefício permitido pelas evidências antes da explicação.","Abra com o estado final e volte ao antes.","Deixe a demonstração provar o resultado sem superlativos."],visual:"Resultado ou uso real ocupa o primeiro frame.",bestFor:["vender","tiktok_shop","comercial"]},
 {family:"pattern_interrupt",mechanisms:["pattern_interrupt","curiosidade"],formulas:[
  "Quebre a expectativa visual nos primeiros frames.","Comece com uma afirmação curta que contrasta com a expectativa.",
  "Entre no meio da ação e revele o contexto depois.","Use silêncio/pausa antes de uma ação relevante.","Faça um corte visual brusco, porém plausível."],visual:"A quebra precisa ser real, não apenas uma frase chamativa.",bestFor:["vender","engajar","tiktok_shop","organico","comercial"]},
 {family:"discovery",mechanisms:["descoberta","curiosidade"],formulas:[
  "Mostre uma descoberta concreta feita em uma situação cotidiana.","Comece no instante em que uma diferença é percebida.",
  "Teste algo que o público reconhece.","Faça uma pequena investigação e revele o achado.","Mostre uma reação causada por um detalhe real."],visual:"Descoberta e reação aparecem antes da explicação.",bestFor:["vender","engajar","tiktok_shop","organico"]},
 {family:"pov",mechanisms:["identificacao","curiosidade"],formulas:[
  "POV de uma situação específica do público.","POV no instante em que o problema aparece.",
  "POV de quando você encontra o que procurava.","POV do instante em que uma mudança se torna perceptível.",
  "POV antes de uma decisão cotidiana e sua consequência."],visual:"A situação do POV já está acontecendo no primeiro frame.",bestFor:["vender","engajar","tiktok_shop","organico"]},
 {family:"before_after",mechanisms:["contraste","resultado"],formulas:[
  "Antes → ação → depois, usando diferenças verificáveis.","Mostre o depois primeiro e volte ao antes.",
  "Estado problemático → intervenção → estado observável.","Mesma rotina com uma única mudança relevante.","Compare estados com enquadramento equivalente."],visual:"Use composição comparável para tornar a diferença legível.",bestFor:["vender","tiktok_shop","comercial"]},
 {family:"reveal",mechanisms:["revelacao","curiosidade"],formulas:[
  "Segure o elemento central fora de vista e revele.","Revele a solução quando o problema parece continuar.",
  "Comece por um detalhe e revele o conjunto.","Abra uma micro-história e revele o contexto depois.","Mostre a evidência antes de dizer o que ela significa."],visual:"Revelação progressiva e fisicamente plausível.",bestFor:["vender","tiktok_shop","engajar","comercial"]},
 {family:"proof",mechanisms:["prova","demo"],formulas:[
  "Demonstre uma característica factual observável.","Comece um teste e faça o público esperar o resultado.",
  "Compare duas opções por um critério verificável.","Mostre a evidência antes da interpretação.","Transforme uma dúvida em demonstração."],visual:"A ação deve provar; a fala apenas contextualiza.",bestFor:["vender","tiktok_shop","educar","comercial"]},
 {family:"comparison",mechanisms:["contraste","curiosidade"],formulas:[
  "Duas alternativas diante do espectador com critério claro.","Compare a rotina com e sem o produto.",
  "Compare detalhes visíveis de construção/textura/aparência.","Comece pela escolha que o público precisa fazer.","Compare duas abordagens sob a mesma condição."],visual:"Lado a lado ou match framing para comparação justa.",bestFor:["vender","educar","tiktok_shop"]},
 {family:"confession",mechanisms:["afinidade","curiosidade"],formulas:[
  "Confissão curta sobre uma experiência real, sem fabricar depoimento.","Admita uma dificuldade que o público reconhece.",
  "Comece pelo detalhe que mudou a história.","Eu fazia X; depois percebi Y, somente com fatos disponíveis.",
  "Admita a objeção mais provável antes de respondê-la."],visual:"Talking head próximo, humano e sem teatralidade.",bestFor:["engajar","vender","organico","tiktok_shop"]},
 {family:"contrarian",mechanisms:["contraste","pattern_interrupt"],formulas:[
  "Desafie uma prática comum somente se houver suporte.","O problema não é X; é Y, quando Y estiver sustentado.",
  "Comece com uma objeção e transforme-a em pergunta.","Apresente uma prática alternativa e prove pelo processo.",
  "Abra com uma decisão que parece errada e explique o contexto."],visual:"A quebra deve ser sustentada pelo conteúdo, não pelo exagero.",bestFor:["engajar","educar","vender","organico"]},
 {family:"identity",mechanisms:["identificacao","pertencimento"],formulas:[
  "Chame diretamente um grupo específico do público.","Se você vive esta situação, veja isso.",
  "Mostre um problema típico de um contexto específico.","Conecte uma cena aspiracional à rotina real.","Fale como alguém que compartilha a mesma situação."],visual:"Ambiente e comportamento devem identificar o público sem estereótipo.",bestFor:["vender","engajar","organico","tiktok_shop"]},
 {family:"list",mechanisms:["curiosidade","numero"],formulas:[
  "Abra com o item mais visual de uma lista curta.","3 sinais/erros/formas, somente se houver exatamente três.",
  "Mostre três usos reais começando pelo mais visual.","Lista curta em ordem de descoberta, sem importância inventada.",
  "Liste respostas a objeções reais."],visual:"O primeiro item já está sendo demonstrado.",bestFor:["educar","vender","engajar","organico"]},
 {family:"demo",mechanisms:["demo","curiosidade"],formulas:[
  "Comece a demonstração sem explicar.","Mostre o gesto-chave que materializa o benefício permitido.",
  "Comece com um movimento de produto incomum, mas plausível.","Deixe a ação provar a característica.","Produto entra exatamente quando o problema aparece."],visual:"Produto em uso real no primeiro frame.",bestFor:["vender","tiktok_shop","comercial"]},
 {family:"story",mechanisms:["story","open_loop"],formulas:[
  "Comece no meio de uma micro-história.","Abra uma promessa narrativa e entregue o payoff no final.",
  "Decisão → consequência observável.","Comece por um momento humano concreto.","Uma pista inicial só ganha significado no final."],visual:"A ação narrativa começa antes da explicação.",bestFor:["engajar","vender","organico","comercial"]},
 {family:"objection",mechanisms:["objection","proof"],formulas:[
  "Abra com a dúvida que impediria a compra.","Transforme a objeção em teste observável.",
  "Compare a opção atual do público com a alternativa.","Responda à objeção mostrando exatamente o uso.","Dúvida → teste → conclusão, sem inventar testemunho."],visual:"A objeção vira uma ação que a câmera consegue mostrar.",bestFor:["vender","tiktok_shop","educar"]},
 {family:"cta_bridge",mechanisms:["curiosidade","cta_claro"],formulas:[
  "Curiosidade aberta conduz naturalmente à próxima ação.","Uso do produto contextualiza a ação de compra.",
  "Problema → produto → próximo passo.","Demonstração curta → convite para conferir.","Entregue uma parte útil e deixe o próximo passo explícito."],visual:"Produto continua visível quando a narrativa entra no CTA.",bestFor:["vender","tiktok_shop","comercial"]},
 {family:"emotional",mechanisms:["emocao","story"],formulas:[
  "Gesto humano específico carrega a emoção.","Acontecimento cotidiano abre uma virada emocional.",
  "Comece no ponto de maior necessidade e conduza à virada.","Frase curta deixa uma resposta emocional em aberto.",
  "Mostre situação humana antes de mostrar alívio/esperança."],visual:"A emoção nasce de gesto, objeto, ação, silêncio ou ambiente; nunca de abstração.",bestFor:["engajar","organico","comercial","jeova_fala"]},
 {family:"number",mechanisms:["numero","curiosidade"],formulas:[
  "Use um número somente quando ele existir nas evidências.","Abra com uma contagem curta e verdadeira.",
  "Transforme uma quantidade real em estrutura de descoberta.","Compare duas quantidades somente se fornecidas.","Use número para organizar, nunca para fabricar autoridade."],visual:"O número pode aparecer na fala/texto, mas a ação visual continua concreta.",bestFor:["vender","educar","engajar","tiktok_shop"]}
];

export const HOOK_LIBRARY:HookPattern[] = FAMILIES.flatMap((f,fi)=>
  f.formulas.map((formula,i)=>({
    id:fi*5+i+1,
    family:f.family,
    mechanisms:f.mechanisms,
    formula,
    visualDirective:f.visual,
    bestFor:f.bestFor
  }))
);

if(HOOK_LIBRARY.length!==100) throw new Error(`KRONIA HOOK INTELLIGENCE: expected 100 patterns, got ${HOOK_LIBRARY.length}`);

function score(p:HookPattern,r:ContentRequest){
  let s=0;
  if(p.bestFor.includes(r.objective)) s+=4;
  if(p.bestFor.includes(r.mode)) s+=3;
  if(p.bestFor.includes(r.project)) s+=2;
  if(r.objective==="vender" && ["demo","result","proof","problem","objection"].includes(p.family)) s+=2;
  if(r.objective==="engajar" && ["curiosity","story","identity","emotional"].includes(p.family)) s+=2;
  if(r.objective==="educar" && p.family==="proof") s+=2;
  return s;
}

/** Seleção determinística de cinco famílias. A LLM cria as palavras exatas
 * usando somente as evidências do pedido; este motor escolhe a mecânica. */
export function selectHookPatterns(request:ContentRequest,count=5){
  const ranked=[...HOOK_LIBRARY].sort((a,b)=>score(b,request)-score(a,request)||a.id-b.id);
  const out:HookPattern[]=[]; const families=new Set<HookFamily>();
  for(const p of ranked){
    if(families.has(p.family)) continue;
    out.push(p); families.add(p.family);
    if(out.length===count) break;
  }
  return out;
}

export function buildHookIntelligenceBrief(request:ContentRequest){
  const selected=selectHookPatterns(request);
  return [
    "KRONIA HOOK INTELLIGENCE — MECÂNICAS SELECIONADAS:",
    ...selected.map((h,i)=>`${i+1}. #${h.id} [${h.family}] ${h.mechanisms.join(" + ")} — ${h.formula} — VISUAL: ${h.visualDirective}`),
    "",
    "Instancie cada mecânica com palavras específicas do produto/tema e do público.",
    "Não copie a fórmula literalmente.",
    "Não invente números, resultados, depoimentos, escassez, autoridade ou características.",
    "Cada hook deve combinar pelo menos dois mecanismos e pertencer a família diferente.",
    "Hook = fala + texto na tela + ação visual + expressão + câmera + som + curiosidade aberta."
  ].join("\n");
}
