import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logoIcon from "../assets/logo-icon.png";
import { generateBlocosVendaFieldsFn } from "../server/blocos-venda.functions";
import { BANNED_PHRASES, normalize as normalizeForClaimsCheck } from "../core/compliance/absolute-claims-guard";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
  publico: string;
  valores: string;
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
}

const STORAGE_KEY = "jf-blocos-v2";

const DEFAULTS: FieldValues = {
  nome: "Jesus",
  publico: "uma mulher",
  valores: "sua fé, sua família e sua paz",
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
};

const PRODUCT_KEYS: (keyof FieldValues)[] = [
  "publico",
  "valores",
  "produto",
  "funcao",
  "dor",
  "fato",
  "proposito",
  "local",
  "visual",
  "demo",
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

function clean(s: string): string {
  return String(s || "").trim().replace(/[.…\s]+$/, "");
}
function cap(s: string): string {
  const c = clean(s);
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : c;
}
function nomeDe(v: FieldValues): string {
  return clean(v.nome) || "avatar";
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
  tempoScript: string;
  fala: (v: FieldValues) => string;
  cena: (v: FieldValues) => string;
  camera: (v: FieldValues) => string;
  acao: (v: FieldValues) => string;
}

const BLOCKS: BlockDef[] = [
  {
    titulo: "Bloco 1 · Gancho + interrupção",
    tempo: "0–10s",
    tempoScript: "00:00–00:10",
    fala: (v) => `Se você é ${clean(v.publico)} que valoriza ${clean(v.valores)}… não passe esse vídeo sem ver isso.`,
    cena: (v) =>
      `${cap(nomeDe(v))} está sentado em ${clean(v.cen)}. ${cap(nomeDe(v))} está com ${clean(v.produto)} fechado nas mãos.\n\nNos primeiros segundos, ${nomeDe(v)} levanta lentamente os olhos do produto e encara diretamente a câmera. Sua expressão é serena, acolhedora e profundamente humana.`,
    camera: () => `Close-up no rosto, movimento lento de aproximação. Fundo desfocado, luz dourada contornando os cabelos. ${VIDEO_SPEC}`,
    acao: (v) =>
      `Ao iniciar a fala, ${nomeDe(v)} segura ${clean(v.produto)} junto ao peito. No final, estende levemente uma das mãos em direção à câmera.`,
  },
  {
    titulo: "Bloco 2 · Revelação do produto",
    tempo: "10–20s",
    tempoScript: "00:10–00:20",
    fala: (v) => `Isso não é só ${clean(v.produto)}… é ${clean(v.funcao)}.`,
    cena: (v) =>
      `Continuação visual do mesmo ambiente. ${cap(nomeDe(v))} pega ${clean(v.produto)} e o posiciona cuidadosamente diante da câmera. A aparência do produto deve permanecer idêntica à referência.`,
    camera: () => `Começa no rosto e faz um movimento descendente suave até o produto. Depois realiza um pequeno avanço cinematográfico no produto. ${VIDEO_SPEC}`,
    acao: (v) =>
      `${cap(nomeDe(v))} olha para o produto por um instante, passa suavemente a mão pela frente dele e então olha novamente para a câmera. Sorriso muito discreto, olhar acolhedor.`,
  },
  {
    titulo: "Bloco 3 · Uso e identificação da dor",
    tempo: "20–30s",
    tempoScript: "00:20–00:30",
    fala: (v) => `Na correria da vida… às vezes ${clean(v.dor)}.`,
    cena: (v) =>
      `${cap(nomeDe(v))} está sentado tranquilamente em ${clean(v.cen)}, com ${clean(v.produto)}: ${clean(v.demo)}. Depois, levanta lentamente os olhos e olha diretamente para a câmera.`,
    camera: () => `Plano médio fechado e estável, com uma aproximação muito suave durante a fala. ${VIDEO_SPEC}`,
    acao: (v) =>
      `Movimento natural dos cabelos e das roupas causado por uma leve brisa. Interpretação íntima, calma e emocional; finaliza mantendo o olhar de ${nomeDe(v)} na câmera.`,
  },
  {
    titulo: "Bloco 4 · Experiência e propósito",
    tempo: "30–40s",
    tempoScript: "00:30–00:40",
    fala: (v) => `${clean(v.fato)} para ${clean(v.proposito)}.`,
    cena: (v) =>
      `Close no produto (${clean(v.produto)}) nas mãos de ${nomeDe(v)}. Ele interage com o produto por alguns segundos, depois o guarda cuidadosamente e o segura junto ao peito.`,
    camera: (v) =>
      `Começa fechada (macro do detalhe) → foco nas mãos → plano médio. Quando ${nomeDe(v)} guarda o produto, a câmera começa a se afastar lentamente, revelando o cenário dourado ao redor. ${VIDEO_SPEC}`,
    acao: (v) =>
      `Ao dizer a última parte da fala, ${nomeDe(v)} olha diretamente para a câmera. Expressão de serenidade, segurança e acolhimento.`,
  },
  {
    titulo: "Bloco 5 · CTA e conversão",
    tempo: "40–50s",
    tempoScript: "00:40–00:50",
    fala: (v) => `Se essa mensagem fez sentido para você… o link está no ${clean(v.local)}, aqui embaixo.`,
    cena: (v) =>
      `${cap(nomeDe(v))} está de frente para a câmera, segurando ${clean(v.produto)} com a mão esquerda, mantendo-o totalmente visível. Olha diretamente para o espectador, com expressão serena e acolhedora.`,
    camera: () => `Plano médio estável, com aproximação muito suave. Sem mudança de cenário nem cortes complexos. ${VIDEO_SPEC}`,
    acao: (v) =>
      `Ao mencionar "${clean(v.local)}", ${nomeDe(v)} levanta a mão direita e aponta claramente para baixo, indicando que o link está abaixo do vídeo — gesto natural e fácil de entender. Depois, mantém o produto visível, volta a mão para uma posição natural e olha para a câmera com um pequeno sorriso sereno.`,
  },
];

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
  { key: "publico", label: "Para quem", hint: "Ex.: uma mulher, um pai, quem trabalha demais" },
  { key: "valores", label: "O que essa pessoa valoriza", hint: "Ex.: sua fé, sua família e sua paz" },
  { key: "produto", label: "Produto", hint: "Com artigo. Ex.: um livro devocional" },
  { key: "funcao", label: "Função emocional", hint: "O que o produto faz pela pessoa, em uma frase" },
  { key: "dor", label: "Dor do dia a dia", hint: 'Entra em "Na correria da vida… às vezes ___."' },
  { key: "fato", label: "Fato verificável do produto", hint: "Só o que está na página do produto. Ex.: São 365 dias" },
  { key: "proposito", label: "Propósito / benefício de longo prazo", hint: 'Entra em "[fato] para ___." Ex.: alimentar sua fé… encontrar força…' },
  { key: "local", label: "Onde está o link", hint: "Ex.: carrinho laranja" },
  { key: "visual", label: "Como o produto aparece na imagem de referência", hint: "Opcional — só se você NÃO for anexar a foto do produto no Flow", textarea: true, group: "produto" },
  { key: "demo", label: "O que ele faz com o produto no bloco 3", hint: 'Ex.: "lê algumas linhas do livro com expressão serena"', textarea: true, group: "produto" },
  { key: "idv", label: "Identidade visual", hint: "Opcional — só se você NÃO for anexar a foto do avatar no Flow", textarea: true, rows: 5, group: "personagem" },
  { key: "voz", label: "Identidade vocal", hint: "", textarea: true, rows: 4, group: "personagem" },
  { key: "cen", label: "Cenário", hint: 'Comece com "um/uma..." — entra na frase "está em ___"', textarea: true, rows: 4, group: "personagem" },
];

export function BlocosVendaGenerator({ onOpenMenu }: { onOpenMenu: () => void }) {
  const generateFieldsRpc = useServerFn(generateBlocosVendaFieldsFn);
  const [values, setValues] = useState<FieldValues>(DEFAULTS);
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
    const dataUrls = await Promise.all(Array.from(files).slice(0, 4 - photos.length).map(readFileAsDataUrl));
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
      const fields = await generateFieldsRpc({ data: { imageDataUrls: photos, contexto: contexto.trim() || undefined } });
      setValues((prev) => ({ ...prev, ...fields }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro ao gerar os campos com IA");
    } finally {
      setAiLoading(false);
    }
  }

  const blocks = useMemo(
    () =>
      BLOCKS.map((b, i) => {
        const fala = b.fala(values);
        const s = estimateSecs(fala);
        return { def: b, fala, words: wordCount(fala), secs: s, over: s > 11, prompt: buildPrompt(b, values, i) };
      }),
    [values],
  );

  const alerts = useMemo(() => {
    const msgs: string[] = [];
    blocks.forEach((blk, i) => {
      if (blk.over) msgs.push(`Bloco ${i + 1}: cerca de ${blk.secs.toFixed(0)}s, passa de 10s. Encurte a fala.`);
    });
    const texto = [values.publico, values.valores, values.produto, values.funcao, values.dor, values.fato, values.proposito].join(" ");
    const bannedPhrase = findBannedPhrase(texto);
    if (bannedPhrase) msgs.push(`Frase de promessa absoluta: "${bannedPhrase}". Só use se estiver na página do produto.`);
    if (DIVINE_RE.test(texto)) msgs.push("O personagem não fala como Deus em 1ª pessoa. Reescreva como mensageiro.");
    if (!values.fato.trim()) msgs.push("Sem fato verificável. O bloco 4 fica incompleto.");
    if (!values.proposito.trim()) msgs.push("Sem propósito/benefício de longo prazo. O bloco 4 fica incompleto.");
    if (!values.nome.trim()) msgs.push('Sem nome de personagem — a fala vai sair como "VOZ OFICIAL DE AVATAR".');
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
      <div className="hint" style={{ marginBottom: 16 }}>
        Anexe a foto do avatar com o produto e deixe a IA gerar os 5 blocos.
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
          </div>
        ))}
      </div>

      <div style={{ marginTop: 4, marginBottom: 24 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => copyText(blocks.map((b) => b.prompt).join("\n\n————————\n\n"), () => setCopiedAll(true))}
        >
          {copiedAll ? "Copiado ✓" : "Copiar os 5 blocos"}
        </button>
      </div>
    </div>
  );
}
