import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logoIcon from "../assets/logo-icon.png";
import { generateBlocosVendaFieldsFn } from "../server/blocos-venda.functions";
import { BANNED_PHRASES, normalize as normalizeForClaimsCheck } from "../core/compliance/absolute-claims-guard";
import { errorMessageOf } from "../lib/errors";
import {
  clean,
  wordCount,
  charCount,
  estimateSecs,
  fieldsUsedBy,
  FALA_TEMPLATES_BY_VARIANT,
  VARIANT_LABEL,
  VARIANT_ORDER,
  type BlocosVendaVariant,
} from "../core/generation/blocos-venda-fala";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Vercel recusa (413 "Request Entity Too Large") requisição de função
 * serverless acima de ~4,5MB — foto de celular direto da câmera já passa
 * disso sozinha, e o RPC manda até 4 de uma vez em base64 (que ainda infla
 * ~33% o tamanho). Redimensiona pro maior lado caber em 1280px e recomprime
 * em JPEG antes de virar data URL — a IA de visão não precisa de mais
 * resolução que isso, e o payload cai pra uma fração do tamanho. */
function downscaleImage(dataUrl: string, maxSide = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Gerador de blocos de venda — porta do artefato "Gerador de blocos de
 * venda" (Jeová Fala) enviado pelo usuário pra dentro do app, substituindo
 * o que estava na aba Prompt. Mesma lógica do HTML original (campos,
 * fórmulas de fala por bloco, contagem de palavras/tempo, alertas de
 * compliance), só reescrita em React/TypeScript e com o localStorage
 * trocado por estado do componente + persistência via localStorage do
 * navegador (mesma chave "jf-blocos-v2" do artefato original, pra quem já
 * tinha preenchido campos lá não perder nada ao abrir aqui).
 */

interface FieldValues {
  nome: string;
  gancho: string;
  produto: string;
  funcao: string;
  dor: string;
  fato: string;
  proposito: string;
  local: string;
  visual: string;
  demo: string;
  idv: string;
  voz: string;
  cen: string;
  /** Só usados na variante "longo". */
  prova: string;
  beneficioExtra: string;
  objecao: string;
}

const STORAGE_KEY = "jf-blocos-v2";

const DEFAULTS: FieldValues = {
  nome: "Jesus",
  gancho: "Se você está precisando de esperança… fica comigo só por alguns segundos.",
  produto: "o devocional Mulheres com Deus",
  funcao: "um lembrete diário para você continuar firme na fé",
  dor: "uma simples palavra é tudo que você precisa para não desistir",
  fato: "São 365 dias",
  proposito: "alimentar sua fé… encontrar força… e lembrar que Deus está com você",
  local: "carrinho laranja",
  visual:
    'Livro de capa rosa-clara com flores, palavra DEVOCIONAL no topo, título "Mulheres com DEUS" em dourado, subtítulo "365 DIAS DE FÉ", símbolo de coroa na contracapa.',
  demo: "lê algumas linhas do livro com expressão serena",
  idv: "Homem de cerca de 35 anos, aparência semítica/mediterrânea, pele morena-oliva, cabelo castanho-escuro longo, ondulado, repartido ao centro, barba cheia castanho-escura bem aparada, olhos castanho-claros, sobrancelhas grossas, nariz reto, rosto oval-alongado. Veste túnica bege/creme de linho rústico com lenço branco no pescoço. Mesmo rosto, mesma túnica e mesmo cabelo em todos os blocos.",
  voz: "Voz masculina jovem, serena e próxima; tom íntimo e emocional, natural e humano; compaixão e segurança; fala calma, sem pressa, com pausas naturais; como uma conversa particular, não uma pregação. Timbre masculino jovem, quente, suave e claro; interpretação com curiosidade, proximidade e preocupação genuína; sem voz grave artificial e sem teatralidade.",
  cen: "um ambiente acolhedor, no final da tarde, com luz dourada suave atravessando o local",
  prova: "milhares de mulheres já usam esse devocional na rotina de oração",
  beneficioExtra: "cabe na bolsa e vem com fita marcadora, pra levar pra qualquer lugar",
  objecao: "não precisa saber de teologia pra entender — a linguagem é simples, dia a dia",
};

const PRODUCT_KEYS: (keyof FieldValues)[] = [
  "gancho",
  "produto",
  "funcao",
  "dor",
  "fato",
  "proposito",
  "local",
  "visual",
  "demo",
  "prova",
  "beneficioExtra",
  "objecao",
];

const VIDEO_SPEC =
  "Vertical 9:16, câmera estável com micro-movimento lento, foco alternando entre rosto e produto. SEM legenda, SEM texto sobreposto e SEM logotipo gerado (entram na edição). Sem música gerada.";

const DIVINE_RE = /\b(eu te (aben[cç]oo|curo|liberto|perdoo|dou)|eu sou (deus|jesus)|meu filho|minha filha)\b/i;

/** Mesma lista de frases de promessa absoluta usada pelo Compliance do
 * resto do app (absolute-claims-guard.ts) — importada, não reescrita aqui,
 * pra nunca ficar desatualizada num lugar e atualizada em outro. */
function findBannedPhrase(texto: string): string | null {
  const normalized = normalizeForClaimsCheck(texto);
  return BANNED_PHRASES.find((phrase) => normalized.includes(normalizeForClaimsCheck(phrase))) ?? null;
}

function cap(s: string): string {
  const c = clean(s);
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : c;
}
function nomeDe(v: FieldValues): string {
  return clean(v.nome) || "avatar";
}

interface BlockDef {
  titulo: string;
  tempo: string;
  tempoScript: string;
  fala: (v: FieldValues) => string;
  cena: (v: FieldValues) => string;
  camera: (v: FieldValues) => string;
  acao: (v: FieldValues) => string;
}

const GANCHO_BLOCK: BlockDef = {
  titulo: "Gancho + interrupção",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.padrao[0].fala,
  cena: (v) =>
    `${cap(nomeDe(v))} está sentado em ${clean(v.cen)}. ${cap(nomeDe(v))} está com ${clean(v.produto)} fechado nas mãos.\n\nNos primeiros segundos, ${nomeDe(v)} levanta lentamente os olhos do produto e encara diretamente a câmera. Sua expressão é serena, acolhedora e profundamente humana.`,
  camera: () => `Close-up no rosto, movimento lento de aproximação. Fundo desfocado, luz dourada contornando os cabelos. ${VIDEO_SPEC}`,
  acao: (v) =>
    `Ao iniciar a fala, ${nomeDe(v)} segura ${clean(v.produto)} junto ao peito. No final, estende levemente uma das mãos em direção à câmera.`,
};
const REVELACAO_BLOCK: BlockDef = {
  titulo: "Revelação do produto",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.padrao[1].fala,
  cena: (v) =>
    `Continuação visual do mesmo ambiente. ${cap(nomeDe(v))} pega ${clean(v.produto)} e o posiciona cuidadosamente diante da câmera. A aparência do produto deve permanecer idêntica à referência.`,
  camera: () => `Começa no rosto e faz um movimento descendente suave até o produto. Depois realiza um pequeno avanço cinematográfico no produto. ${VIDEO_SPEC}`,
  acao: (v) =>
    `${cap(nomeDe(v))} olha para o produto por um instante, passa suavemente a mão pela frente dele e então olha novamente para a câmera. Sorriso muito discreto, olhar acolhedor.`,
};
const DOR_BLOCK: BlockDef = {
  titulo: "Uso e identificação da dor",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.padrao[2].fala,
  cena: (v) =>
    `${cap(nomeDe(v))} está sentado tranquilamente em ${clean(v.cen)}, com ${clean(v.produto)}: ${clean(v.demo)}. Depois, levanta lentamente os olhos e olha diretamente para a câmera.`,
  camera: () => `Plano médio fechado e estável, com uma aproximação muito suave durante a fala. ${VIDEO_SPEC}`,
  acao: (v) =>
    `Movimento natural dos cabelos e das roupas causado por uma leve brisa. Interpretação íntima, calma e emocional; finaliza mantendo o olhar de ${nomeDe(v)} na câmera.`,
};
const PROVA_BLOCK: BlockDef = {
  titulo: "Prova / demonstração extra",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.longo[3].fala,
  cena: (v) =>
    `${cap(nomeDe(v))} demonstra ${clean(v.produto)} em uso, de forma mais detalhada, mostrando um segundo ângulo ou detalhe do produto.`,
  camera: () => `Plano médio com leve aproximação, focando no detalhe do produto em uso. ${VIDEO_SPEC}`,
  acao: (v) =>
    `${cap(nomeDe(v))} manuseia ${clean(v.produto)} com cuidado, destacando um detalhe específico antes de olhar novamente para a câmera.`,
};
const ALIVIO_BLOCK: BlockDef = {
  titulo: "Experiência e propósito",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.padrao[3].fala,
  cena: (v) =>
    `Close no produto (${clean(v.produto)}) nas mãos de ${nomeDe(v)}. Ele interage com o produto por alguns segundos, depois o guarda cuidadosamente e o segura junto ao peito.`,
  camera: (v) =>
    `Começa fechada (macro do detalhe) → foco nas mãos → plano médio. Quando ${nomeDe(v)} guarda o produto, a câmera começa a se afastar lentamente, revelando o cenário dourado ao redor. ${VIDEO_SPEC}`,
  acao: (v) =>
    `Ao dizer a última parte da fala, ${nomeDe(v)} olha diretamente para a câmera. Expressão de serenidade, segurança e acolhimento.`,
};
const BENEFICIO_EXTRA_BLOCK: BlockDef = {
  titulo: "Benefício extra",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.longo[5].fala,
  cena: (v) => `${cap(nomeDe(v))} está em ${clean(v.cen)}, com expressão tranquila, reforçando um segundo benefício do produto.`,
  camera: () => `Plano médio estável, aproximação sutil. ${VIDEO_SPEC}`,
  acao: (v) => `${cap(nomeDe(v))} gesticula suavemente ao falar, mantendo o olhar na câmera.`,
};
const OBJECAO_BLOCK: BlockDef = {
  titulo: "Quebra de objeção",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.longo[6].fala,
  cena: (v) => `${cap(nomeDe(v))} encara a câmera diretamente, respondendo a uma dúvida comum sobre ${clean(v.produto)}.`,
  camera: () => `Close-up estável, sem movimento brusco. ${VIDEO_SPEC}`,
  acao: (v) => `${cap(nomeDe(v))} balança a cabeça suavemente em sinal de segurança, mantendo tom calmo e confiante.`,
};
const CTA_BLOCK: BlockDef = {
  titulo: "CTA e conversão",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.padrao[4].fala,
  cena: (v) =>
    `${cap(nomeDe(v))} está de frente para a câmera, segurando ${clean(v.produto)} com a mão esquerda, mantendo-o totalmente visível. Olha diretamente para o espectador, com expressão serena e acolhedora.`,
  camera: () => `Plano médio estável, com aproximação muito suave. Sem mudança de cenário nem cortes complexos. ${VIDEO_SPEC}`,
  acao: (v) =>
    `Ao mencionar "${clean(v.local)}", ${nomeDe(v)} levanta a mão direita e aponta claramente para baixo, indicando que o link está abaixo do vídeo — gesto natural e fácil de entender. Depois, mantém o produto visível, volta a mão para uma posição natural e olha para a câmera com um pequeno sorriso sereno.`,
};
/** Só pra "curto" — revelação e dor combinadas numa frase só (a fala vem
 * de FALA_TEMPLATES_BY_VARIANT.curto[1], que já é a versão combinada). */
const REVELACAO_DOR_CURTO_BLOCK: BlockDef = {
  titulo: "Revelação + dor",
  tempo: "",
  tempoScript: "",
  fala: FALA_TEMPLATES_BY_VARIANT.curto[1].fala,
  cena: (v) =>
    `Continuação visual do mesmo ambiente. ${cap(nomeDe(v))} pega ${clean(v.produto)} e mostra brevemente, depois volta o olhar pra câmera com expressão mais séria, reconhecendo uma dificuldade real do dia a dia.`,
  camera: () => `Pequeno movimento até o produto e retorno ao rosto, plano médio fechado. ${VIDEO_SPEC}`,
  acao: (v) =>
    `${cap(nomeDe(v))} segura ${clean(v.produto)} por um instante, depois baixa levemente o olhar antes de voltar a encarar a câmera com empatia.`,
};

/** Cada variante monta sua sequência de blocos de 10s reaproveitando os
 * mesmos blocos-base (mesma "espinha" gancho → desenvolvimento → CTA) —
 * "padrao" é EXATAMENTE a sequência que já existia antes das variantes. */
const BLOCKS_BY_VARIANT: Record<BlocosVendaVariant, BlockDef[]> = {
  curto: [GANCHO_BLOCK, REVELACAO_DOR_CURTO_BLOCK, CTA_BLOCK],
  padrao: [GANCHO_BLOCK, REVELACAO_BLOCK, DOR_BLOCK, ALIVIO_BLOCK, CTA_BLOCK],
  longo: [GANCHO_BLOCK, REVELACAO_BLOCK, DOR_BLOCK, PROVA_BLOCK, ALIVIO_BLOCK, BENEFICIO_EXTRA_BLOCK, OBJECAO_BLOCK, CTA_BLOCK],
};

function blocksFor(variant: BlocosVendaVariant): BlockDef[] {
  return BLOCKS_BY_VARIANT[variant].map((b, i) => {
    const start = i * 10;
    const end = start + 10;
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      ...b,
      titulo: `Bloco ${i + 1} · ${b.titulo}`,
      tempo: `${start}–${end}s`,
      tempoScript: `00:${pad(start)}–00:${pad(end)}`,
    };
  });
}

function buildPrompt(b: BlockDef, v: FieldValues, index: number): string {
  const nomeCaixaAlta = nomeDe(v).toUpperCase();
  return [
    `SCRIPT ${String(index + 1).padStart(2, "0")} — ${b.tempoScript}`,
    "",
    b.titulo.split("·")[1]?.trim().toUpperCase() ?? b.titulo.toUpperCase(),
    "",
    `CENA: ${b.cena(v)}`,
    "",
    `CÂMERA: ${b.camera(v)}`,
    "",
    `AÇÃO: ${b.acao(v)}`,
    "",
    `FALA — VOZ OFICIAL DE ${nomeCaixaAlta}:`,
    "",
    `"${b.fala(v)}"`,
    "",
    `VOZ: ${v.voz}`,
  ].join("\n");
}

function loadStoredValues(): FieldValues {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    const merged = { ...DEFAULTS };
    (Object.keys(DEFAULTS) as (keyof FieldValues)[]).forEach((k) => {
      if (typeof raw[k] === "string") merged[k] = raw[k];
    });
    return merged;
  } catch {
    return DEFAULTS;
  }
}

const FIELD_LABELS: { key: keyof FieldValues; label: string; hint: string; textarea?: boolean; rows?: number; group?: "produto" | "personagem" }[] = [
  { key: "nome", label: "Nome do personagem/avatar", hint: 'Aparece como "VOZ OFICIAL DE ___" na fala' },
  { key: "gancho", label: "Gancho (fala do bloco 1)", hint: "A frase pronta de abertura — livre, sem molde fixo. Ex.: \"Se você está precisando de esperança… fica comigo só por alguns segundos.\"", textarea: true, rows: 2 },
  { key: "produto", label: "Produto", hint: "Com artigo. Ex.: um livro devocional" },
  { key: "funcao", label: "Função emocional", hint: "O que o produto faz pela pessoa, em uma frase" },
  { key: "dor", label: "Dor do dia a dia", hint: 'Entra em "Na correria da vida… às vezes ___."' },
  { key: "fato", label: "Fato verificável do produto", hint: "Só o que está na página do produto. Ex.: São 365 dias" },
  { key: "proposito", label: "Propósito / benefício de longo prazo", hint: 'Entra em "[fato] para ___." Ex.: alimentar sua fé… encontrar força…' },
  { key: "local", label: "Onde está o link", hint: "Ex.: carrinho laranja" },
  { key: "prova", label: "Prova / demonstração extra (variante Longo)", hint: "Um detalhe concreto que reforça credibilidade" },
  { key: "beneficioExtra", label: "Benefício extra (variante Longo)", hint: "Um segundo benefício, diferente da função emocional" },
  { key: "objecao", label: "Resposta a uma dúvida comum (variante Longo)", hint: "Ex.: preço, dificuldade de uso, se funciona mesmo" },
  { key: "visual", label: "Como o produto aparece na imagem de referência", hint: "Opcional — só se você NÃO for anexar a foto do produto no Flow", textarea: true, group: "produto" },
  { key: "demo", label: "O que ele faz com o produto no bloco 3", hint: 'Ex.: "lê algumas linhas do livro com expressão serena"', textarea: true, group: "produto" },
  { key: "idv", label: "Identidade visual", hint: "Opcional — só se você NÃO for anexar a foto do avatar no Flow", textarea: true, rows: 5, group: "personagem" },
  { key: "voz", label: "Identidade vocal", hint: "", textarea: true, rows: 4, group: "personagem" },
  { key: "cen", label: "Cenário", hint: 'Comece com "um/uma..." — entra na frase "está em ___"', textarea: true, rows: 4, group: "personagem" },
];

export function BlocosVendaGenerator({ onOpenMenu }: { onOpenMenu: () => void }) {
  const generateFieldsRpc = useServerFn(generateBlocosVendaFieldsFn);
  const [values, setValues] = useState<FieldValues>(DEFAULTS);
  const [variant, setVariant] = useState<BlocosVendaVariant>("padrao");
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [contexto, setContexto] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setValues(loadStoredValues());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // localStorage indisponível — perde só a persistência entre sessões, o gerador continua funcionando.
    }
  }, [values]);

  function setField(key: keyof FieldValues, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function voltarAoExemplo() {
    setValues(DEFAULTS);
  }
  function limparCamposDoProduto() {
    setValues((prev) => {
      const next = { ...prev };
      PRODUCT_KEYS.forEach((k) => (next[k] = ""));
      return next;
    });
  }

  async function handleAddPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const rawDataUrls = await Promise.all(Array.from(files).slice(0, 4 - photos.length).map(readFileAsDataUrl));
    const dataUrls = await Promise.all(rawDataUrls.map((d) => downscaleImage(d)));
    setPhotos((prev) => [...prev, ...dataUrls].slice(0, 4));
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleGenerateWithAi() {
    if (photos.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const fields = await generateFieldsRpc({ data: { imageDataUrls: photos, contexto: contexto.trim() || undefined, variant } });
      setValues((prev) => ({ ...prev, ...fields }));
    } catch (err) {
      setAiError(errorMessageOf(err, "Erro ao gerar os campos com IA"));
    } finally {
      setAiLoading(false);
    }
  }

  const blocks = useMemo(() => {
    const defs = blocksFor(variant);
    return defs.map((b, i) => {
      const fala = b.fala(values);
      const s = estimateSecs(fala);
      return { def: b, fala, words: wordCount(fala), chars: charCount(fala), secs: s, over: s > 11, prompt: buildPrompt(b, values, i) };
    });
  }, [values, variant]);

  const alerts = useMemo(() => {
    const msgs: string[] = [];
    const used = fieldsUsedBy(variant);
    blocks.forEach((blk, i) => {
      if (blk.over) msgs.push(`Bloco ${i + 1}: cerca de ${blk.secs.toFixed(0)}s, passa de 10s. Encurte a fala.`);
    });
    const texto = [values.gancho, values.produto, values.funcao, values.dor, values.fato, values.proposito].join(" ");
    const bannedPhrase = findBannedPhrase(texto);
    if (bannedPhrase) msgs.push(`Frase de promessa absoluta: "${bannedPhrase}". Só use se estiver na página do produto.`);
    if (DIVINE_RE.test(texto)) msgs.push("O personagem não fala como Deus em 1ª pessoa. Reescreva como mensageiro.");
    if (used.has("fato") && !values.fato.trim()) msgs.push("Sem fato verificável. O bloco de alívio fica incompleto.");
    if (used.has("proposito") && !values.proposito.trim()) msgs.push("Sem propósito/benefício de longo prazo. O bloco de alívio fica incompleto.");
    if (used.has("prova") && !values.prova.trim()) msgs.push("Sem prova/demonstração extra. O bloco de prova fica incompleto.");
    if (used.has("beneficioExtra") && !values.beneficioExtra.trim()) msgs.push("Sem benefício extra. O bloco de benefício extra fica incompleto.");
    if (used.has("objecao") && !values.objecao.trim()) msgs.push("Sem resposta a dúvida comum. O bloco de quebra de objeção fica incompleto.");
    if (!values.nome.trim()) msgs.push('Sem nome de personagem — a fala vai sair como "VOZ OFICIAL DE AVATAR".');
    return msgs;
  }, [blocks, values, variant]);

  async function copyText(text: string, onDone: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
    } catch {
      // clipboard indisponível — o texto já está visível na tela pra copiar manualmente.
    }
  }

  const produtoFields = FIELD_LABELS.filter((f) => !f.group);
  const produtoDetalhado = FIELD_LABELS.filter((f) => f.group === "produto");
  const personagemFields = FIELD_LABELS.filter((f) => f.group === "personagem");

  function renderField(f: (typeof FIELD_LABELS)[number]) {
    const val = values[f.key];
    return (
      <div key={f.key} style={{ marginBottom: 14 }}>
        <div className="section-label" style={{ marginBottom: 4 }}>
          {f.label}
          {f.hint && <span style={{ fontWeight: 400, color: "var(--kr-muted-2)" }}> — {f.hint}</span>}
        </div>
        {f.textarea ? (
          <textarea
            className="input"
            rows={f.rows ?? 3}
            value={val}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        ) : (
          <input className="input" value={val} onChange={(e) => setField(f.key, e.target.value)} />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="brand-row">
        <button type="button" onClick={onOpenMenu} className="brand-back" aria-label="Abrir menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        <img src={logoIcon} alt="Kronia" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1, lineHeight: 1 }}>
          <div className="brand-word">KRONIA</div>
          <div className="brand-sub">CRIADOR INTELIGENTE</div>
        </div>
      </div>
      <h1 className="h1" style={{ fontSize: 20, marginBottom: 4 }}>
        Blocos de venda
      </h1>
      <div className="hint" style={{ marginBottom: 12 }}>
        Anexe a foto do avatar com o produto e deixe a IA gerar os blocos.
      </div>

      <div className="section-label" style={{ marginBottom: 6 }}>
        Duração
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {VARIANT_ORDER.map((v) => (
          <button
            key={v}
            type="button"
            className={`pill ${variant === v ? "active" : ""}`}
            style={{ flex: 1, padding: "10px 0", fontSize: 12.5 }}
            onClick={() => setVariant(v)}
          >
            {VARIANT_LABEL[v]}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>
          Gerar tudo com IA a partir da foto
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={src} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }} />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label="Remover foto"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--kr-card-2)",
                  border: "1px solid var(--kr-line)",
                  color: "var(--kr-ink)",
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                border: "1px dashed var(--kr-line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: "var(--kr-muted)",
                cursor: "pointer",
              }}
            >
              +
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  handleAddPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>Foto do avatar segurando o produto (ou uma de cada).</div>
        <input
          className="input"
          placeholder="Contexto opcional (ex.: nome do produto, se não estiver legível na foto)"
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <button type="button" className="btn-primary" onClick={handleGenerateWithAi} disabled={photos.length === 0 || aiLoading}>
          {aiLoading ? "Gerando com IA..." : "Gerar campos com IA"}
        </button>
        {aiError && (
          <div className="hint" style={{ color: "#DC2626", marginTop: 8 }}>
            {aiError}
          </div>
        )}
      </div>

      {/* Campos manuais escondidos por padrão — o fluxo principal é só
          anexar a foto e deixar a IA preencher tudo; quem quiser mexer
          campo a campo abre aqui. */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14.5, padding: "4px 0" }}>
          Editar campos manualmente
        </summary>
        <div style={{ marginTop: 14 }}>
          {produtoFields.map(renderField)}

          <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, padding: "4px 0" }}>
              Produto na imagem e demonstração
            </summary>
            <div style={{ marginTop: 12 }}>{produtoDetalhado.map(renderField)}</div>
          </details>

          <details style={{ marginBottom: 18 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, padding: "4px 0" }}>
              Personagem e cenário
            </summary>
            <div style={{ marginTop: 12 }}>{personagemFields.map(renderField)}</div>
          </details>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-secondary" onClick={voltarAoExemplo}>
              Voltar ao exemplo
            </button>
            <button type="button" className="btn-secondary" onClick={limparCamposDoProduto}>
              Limpar campos do produto
            </button>
          </div>
        </div>
      </details>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Alertas</h2>
      {alerts.length === 0 ? (
        <div className="hint" style={{ color: "#166534", marginBottom: 20 }}>
          Sem alertas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {alerts.map((msg, i) => (
            <div key={i} style={{ background: "var(--kr-tint)", color: "var(--kr-accent-ink)", borderRadius: 10, padding: "8px 12px", fontSize: 13.5, fontWeight: 500 }}>
              {msg}
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Blocos</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 90 }}>
        {blocks.map((blk, i) => (
          <div key={i} className="card">
            <h3 style={{ fontSize: 15, margin: "0 0 2px" }}>{blk.def.titulo}</h3>
            <div style={{ color: "var(--kr-muted)", fontSize: 12, marginBottom: 8 }}>{blk.def.tempo}</div>
            <p style={{ fontSize: 16.5, margin: "0 0 10px", paddingLeft: 10, borderLeft: "3px solid var(--kr-accent-2)" }}>{blk.fala}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: blk.over ? "#DC2626" : "#166534", marginBottom: 10 }}>
              {blk.words} palavras · {blk.chars} letras · cerca de {blk.secs.toFixed(0)}s
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ marginBottom: 8 }}
              onClick={() => copyText(blk.prompt, () => setCopiedBlock(i))}
            >
              {copiedBlock === i ? "Copiado ✓" : "Copiar bloco"}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 4, marginBottom: 24 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => copyText(blocks.map((b) => b.prompt).join("\n\n————————\n\n"), () => setCopiedAll(true))}
        >
          {copiedAll ? "Copiado ✓" : `Copiar os ${blocks.length} blocos`}
        </button>
      </div>
    </div>
  );
}
