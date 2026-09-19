import { useEffect, useMemo, useState } from "react";
import logoIcon from "../assets/logo-icon.png";

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
  publico: string;
  valores: string;
  produto: string;
  funcao: string;
  dor: string;
  fato: string;
  local: string;
  visual: string;
  demo: string;
  idv: string;
  voz: string;
  cen: string;
}

const STORAGE_KEY = "jf-blocos-v2";

const DEFAULTS: FieldValues = {
  publico: "uma mulher",
  valores: "sua fé, sua família e sua paz",
  produto: "um livro devocional",
  funcao: "um lembrete diário pra você continuar firme na fé",
  dor: "Às vezes uma palavra é tudo pra não desistir",
  fato: "São 365 dias de força e fé",
  local: "carrinho laranja",
  visual:
    'Livro de capa rosa-clara com flores, palavra DEVOCIONAL no topo, título "Mulheres com DEUS" em dourado, subtítulo "365 DIAS DE FÉ", símbolo de coroa na contracapa.',
  demo: "abre o livro e folheia devagar, lendo com olhar baixo e sereno; depois fecha e o segura junto ao peito com as mãos sobrepostas",
  idv: "Homem de cerca de 35 anos, aparência semítica/mediterrânea, pele morena-oliva, cabelo castanho-escuro longo, ondulado, repartido ao centro, barba cheia castanho-escura bem aparada, olhos castanho-claros, sobrancelhas grossas, nariz reto, rosto oval-alongado. Veste túnica bege/creme de linho rústico com lenço branco no pescoço. Mesmo rosto, mesma túnica e mesmo cabelo em todos os blocos.",
  voz: "Voz masculina jovem, serena, próxima e íntima, tom acolhedor, ritmo calmo com pausas naturais, sensação de conversa particular. Não é pregação, locução nem publicidade. Sem teatralidade exagerada. Português do Brasil.",
  cen: "Terraço de pedra ao entardecer, luz dourada de pôr do sol vindo de trás/lateral, colinas suaves ao fundo desfocadas, galho de oliveira e flores rosas no canto do quadro. Mesmo cenário, mesma hora do dia e mesma direção de luz em todos os blocos.",
};

const PRODUCT_KEYS: (keyof FieldValues)[] = ["publico", "valores", "produto", "funcao", "dor", "fato", "local", "visual", "demo"];

const VIDEO_SPEC =
  "Vertical 9:16, câmera estável com micro-movimento lento, foco alternando entre rosto e produto. SEM legenda, SEM texto sobreposto e SEM logotipo gerado (entram na edição). Sem música gerada.";

const CLAIMS_RE = /\b(melhor|garantid[oa]s?|garantia|milagre|milagros[oa]|cura|curar|todo mundo|único|comprovad[oa]|aprovad[oa]|resultado)\b/i;
const DIVINE_RE = /\b(eu te (aben[cç]oo|curo|liberto|perdoo|dou)|eu sou (deus|jesus)|meu filho|minha filha)\b/i;

function clean(s: string): string {
  return String(s || "").trim().replace(/[.…\s]+$/, "");
}
function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => w && w !== "…").length;
}
function estimateSecs(s: string): number {
  return wordCount(s) / 2.1 + 1.2;
}

interface BlockDef {
  titulo: string;
  tempo: string;
  fala: (v: FieldValues) => string;
  atuacao: (v: FieldValues) => string;
  movimento: string;
  camera: string;
}

const BLOCKS: BlockDef[] = [
  {
    titulo: "Bloco 1 · Chamada e comando",
    tempo: "0–10s",
    fala: (v) => `Se você é ${clean(v.publico)} que valoriza ${clean(v.valores)}… não passe esse vídeo sem ver.`,
    atuacao: () =>
      "Sentado no terraço, segura o produto junto ao peito, visível desde o primeiro frame. Olha direto para a câmera, como quem fala com uma pessoa específica. No final faz um leve gesto com a mão livre pedindo atenção.",
    movimento: "Respiração calma, piscar natural, mão livre se abre devagar. O produto não se deforma nem troca de lugar bruscamente.",
    camera: "Plano médio (cintura para cima), câmera na altura dos olhos, leve push-in.",
  },
  {
    titulo: "Bloco 2 · Produto como função",
    tempo: "10–20s",
    fala: (v) => `Este é ${clean(v.produto)}… ${clean(v.funcao)}.`,
    atuacao: () =>
      "Mesmo cenário e posição. Aproxima o produto da câmera com as duas mãos, mostrando-o inteiro e nítido. O olhar alterna entre a câmera e o produto. Expressão terna e segura.",
    movimento: "Rotação lenta e curta para mostrar a frente do produto; dedos nas bordas, sem cobrir título ou detalhes.",
    camera: "Plano médio fechando para o produto em destaque; foco no produto e depois retorna ao rosto.",
  },
  {
    titulo: "Bloco 3 · Dor e fato",
    tempo: "20–30s",
    fala: (v) => `${clean(v.dor)}… ${clean(v.fato)}.`,
    atuacao: (v) => `Ele ${clean(v.demo)}.`,
    movimento: "Gestos com peso e velocidade reais. Sem texto legível inventado. Mãos com cinco dedos e contato correto com o produto.",
    camera: "Plano médio, um insert fechado (macro) do detalhe e das mãos, e retorno ao plano médio-aberto.",
  },
  {
    titulo: "Bloco 4 · CTA condicional",
    tempo: "30–40s",
    fala: (v) => `Se essa mensagem fez sentido pra você… o link está no ${clean(v.local)}, aqui embaixo.`,
    atuacao: () =>
      "Volta ao plano do bloco 1. Segura o produto com a frente virada para a câmera, expressão serena e leve sorriso. No final aponta suavemente para baixo com a mão livre.",
    movimento: "Movimento mínimo. Produto estável e legível. Gesto para baixo lento e natural.",
    camera: "Plano médio estável, sem push-in, para o produto ficar nítido até o último frame.",
  },
];

function buildPrompt(b: BlockDef, v: FieldValues): string {
  return [
    `${b.titulo.toUpperCase()} (${b.tempo})`,
    "",
    `IDENTIDADE VISUAL: ${v.idv}`,
    "",
    `IDENTIDADE VOCAL: ${v.voz}`,
    "",
    `CENÁRIO: ${v.cen}`,
    "",
    `PRODUTO (TRAVA): Usar a imagem de referência do produto como fonte absoluta de verdade. ${v.visual} Não redesenhar, não inventar detalhes, não trocar cor nem proporção. Nenhum outro texto no produto.`,
    "",
    `ATUAÇÃO: ${b.atuacao(v)}`,
    "",
    `MOVIMENTO NATURAL: ${b.movimento}`,
    "",
    `DIREÇÃO: ${b.camera} ${VIDEO_SPEC}`,
    "",
    'FALA EXATA (dizer somente isto, com pausas naturais):',
    `"${b.fala(v)}"`,
    "",
    "CONTINUIDADE: mesmo personagem, mesma túnica, mesmo terraço, mesma luz dourada e mesmo produto (cor, forma e proporção idênticos) do primeiro ao último frame.",
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
  { key: "publico", label: "Para quem", hint: "Ex.: uma mulher, um pai, quem trabalha demais" },
  { key: "valores", label: "O que essa pessoa valoriza", hint: "Ex.: sua fé, sua família e sua paz" },
  { key: "produto", label: "Produto", hint: "Com artigo. Ex.: um livro devocional" },
  { key: "funcao", label: "Função emocional", hint: "O que o produto faz pela pessoa, em uma frase" },
  { key: "dor", label: "Dor do dia a dia", hint: "Curta. Máximo 10 palavras" },
  { key: "fato", label: "Fato verificável do produto", hint: "Só o que está na página do produto. Ex.: 365 dias" },
  { key: "local", label: "Onde está o link", hint: "Ex.: carrinho laranja" },
  { key: "visual", label: "Como o produto aparece na imagem de referência", hint: "Cor, título, detalhes visíveis. Nada que não esteja na foto", textarea: true, group: "produto" },
  { key: "demo", label: "O que ele faz com o produto no bloco 3", hint: "", textarea: true, group: "produto" },
  { key: "idv", label: "Identidade visual", hint: "", textarea: true, rows: 5, group: "personagem" },
  { key: "voz", label: "Identidade vocal", hint: "", textarea: true, rows: 4, group: "personagem" },
  { key: "cen", label: "Cenário", hint: "", textarea: true, rows: 4, group: "personagem" },
];

export function BlocosVendaGenerator({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [values, setValues] = useState<FieldValues>(DEFAULTS);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

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

  const blocks = useMemo(
    () =>
      BLOCKS.map((b) => {
        const fala = b.fala(values);
        const s = estimateSecs(fala);
        return { def: b, fala, words: wordCount(fala), secs: s, over: s > 11, prompt: buildPrompt(b, values) };
      }),
    [values],
  );

  const alerts = useMemo(() => {
    const msgs: string[] = [];
    blocks.forEach((blk, i) => {
      if (blk.over) msgs.push(`Bloco ${i + 1}: cerca de ${blk.secs.toFixed(0)}s, passa de 10s. Encurte a fala.`);
    });
    const texto = [values.publico, values.valores, values.produto, values.funcao, values.dor, values.fato].join(" ");
    const claimMatch = texto.match(CLAIMS_RE);
    if (claimMatch) msgs.push(`Palavra de promessa: "${claimMatch[0]}". Só use se estiver na página do produto.`);
    if (DIVINE_RE.test(texto)) msgs.push("O personagem não fala como Deus em 1ª pessoa. Reescreva como mensageiro.");
    if (!values.fato.trim()) msgs.push("Sem fato verificável. O bloco 3 fica só com a dor.");
    if (!values.visual.trim()) msgs.push("Descreva o produto como aparece na referência para travar o visual.");
    return msgs;
  }, [blocks, values]);

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
          {f.hint && <span style={{ fontWeight: 400, color: "#6B6B6B" }}> — {f.hint}</span>}
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
      <div className="hint" style={{ marginBottom: 16 }}>
        Preencha os campos. Saem 4 blocos de cerca de 10s, prontos para colar no Flow.
      </div>

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

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button type="button" className="btn-secondary" onClick={voltarAoExemplo}>
          Voltar ao exemplo
        </button>
        <button type="button" className="btn-secondary" onClick={limparCamposDoProduto}>
          Limpar campos do produto
        </button>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Alertas</h2>
      {alerts.length === 0 ? (
        <div className="hint" style={{ color: "#4E6B3A", marginBottom: 20 }}>
          Sem alertas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {alerts.map((msg, i) => (
            <div key={i} style={{ background: "#3C2419", color: "#F09A72", borderRadius: 10, padding: "8px 12px", fontSize: 13.5, fontWeight: 500 }}>
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
            <div style={{ color: "#8A8A8A", fontSize: 12, marginBottom: 8 }}>{blk.def.tempo}</div>
            <p style={{ fontSize: 16.5, margin: "0 0 10px", paddingLeft: 10, borderLeft: "3px solid #FF8A1A" }}>{blk.fala}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: blk.over ? "#F09A72" : "#9CC27F", marginBottom: 10 }}>
              {blk.words} palavras · cerca de {blk.secs.toFixed(0)}s
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ marginBottom: 8 }}
              onClick={() => copyText(blk.prompt, () => setCopiedBlock(i))}
            >
              {copiedBlock === i ? "Copiado ✓" : "Copiar bloco"}
            </button>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Ver prompt completo</summary>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, background: "#0D0D0D", border: "1px solid #232323", borderRadius: 10, padding: 12, marginTop: 8, maxHeight: 320, overflow: "auto" }}>
                {blk.prompt}
              </pre>
            </details>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: "calc(88px + env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          className="btn-primary"
          onClick={() => copyText(blocks.map((b) => b.prompt).join("\n\n————————\n\n"), () => setCopiedAll(true))}
        >
          {copiedAll ? "Copiado ✓" : "Copiar os 4 blocos"}
        </button>
      </div>
    </div>
  );
}
