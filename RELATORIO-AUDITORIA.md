# Relatório de auditoria — KRONIA Criador Inteligente

Data: sessão de auditoria do núcleo (`src/core`, `src/lib`) + tentativa de
correção da Ingestão. Cobre o que foi encontrado, o que foi corrigido, e o
que continua quebrado com o motivo exato.

---

## 1. CRÍTICO — corrigido e no ar (commit `807c0df`)

**O quê**: `src/lib/openai.ts` convertia os schemas Zod pra JSON Schema com
`target: "openApi3"` (zod-to-json-schema), que gera
`"exclusiveMinimum": true` (booleano, estilo JSON Schema draft-04) em campos
`.positive()` como `FlowSegmentSchema.endSeconds` e
`VideoAnalysisSchema.durationSeconds`.

**Efeito real**: a OpenAI, em modo strict, rejeita esse schema com
`400 Invalid schema for response_format: True is not of type 'number'`.

**Alcance**: como o agente **Psicologia de Compra roda em toda geração,
sempre**, sem checar `project` (`src/core/generation/generate.ts`), isso
provavelmente quebrava **toda chamada real** ao pipeline (não as chamadas
mockadas do smoke-test, que usam um servidor local que não valida schema
como a OpenAI faz). Também afetava o agente Teólogo e a análise visual da
Ingestão.

**Por que passou despercebido**: é exatamente o mesmo tipo de bug que você
já tinha corrigido antes em `src/lib/llm.ts` (o caminho de fallback pra
OpenAI quando a Groq estoura cota) — só que `lib/openai.ts` é um arquivo
irmão, usado pelos agentes que rodam direto na OpenAI, e nunca foi tocado
pelos seus 3 commits de correção.

**Correção**: trocado pra `target: "jsonSchema7"` (gera o valor numérico
correto). Testado contra os 4 schemas relevantes — nenhum
`exclusiveMinimum`/`exclusiveMaximum` booleano restante.

**Status**: ✅ corrigido, testado, no ar em produção.

---

## 2. ALTO RISCO — não corrigido, Ingestão desligada (commit `4dc9065`)

**O quê**: o Caminho A (gerar roteiro a partir de um vídeo de referência)
depende de 3 binários externos — `yt-dlp`, `ffmpeg`, `ffprobe` — chamados
via `execFile` em `src/core/ingestion/{download,frames,whisper}.ts`.
Nenhum dos três vem instalado no runtime serverless do Vercel.

**Tentei corrigir de verdade antes de desistir.** Três tentativas, três
falhas diferentes, todas reproduzidas ao vivo (não é suposição):

### Tentativa 1 — pacote npm `youtube-dl-exec`
Vendoriza yt-dlp automaticamente no `npm install`.
**Falha**: o install quebrou na hora, com rate limit da API do GitHub:
```
npm error Error: {
  "message": "API rate limit exceeded for 34.170.141.253...",
  "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
}
```
O mesmo tipo de falha intermitente aconteceria num build do Vercel
(servidores de build compartilham IP entre muitos usuários, mais propensos
a rate limit ainda).

### Tentativa 2 — `ffmpeg-static` + `@ffprobe-installer/ffprobe` via `require` normal
Pacotes maduros, amplamente usados em produção Vercel/Lambda.
**Falha**: inspecionei o `.output/server` depois do build e o pacote só
empacota o **código JS que calcula o caminho** do binário
(`path.join(__dirname, 'ffmpeg')`), não o binário em si. Em produção
(onde só `.output` é implantado, não o `node_modules` completo) esse
caminho apontaria pra um arquivo que não existe.

### Tentativa 3 — vendorizar os 3 binários direto no repo (`vendor/`) via `serverAssets` do Nitro
A saída "correta": baixei os binários (testei que rodam), configurei
`vite.config.ts` pra empacotá-los como asset do servidor, criei um helper
que extrai pra `/tmp` na primeira execução (único diretório gravável em
runtime serverless).

Sozinho, o yt-dlp (40MB) empacotou certo — confirmado no build
(`.output/server/_virtual/yt-dlp.mjs`, 54MB, batendo com a inflação
esperada do base64).

**Falha**: somando os 3 (`yt-dlp` 40MB + `ffmpeg` 79MB + `ffprobe` 79MB ≈
200MB), o processo de build **estourou a memória e crashou**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
Aborted
```
Depois de 3m23s de build. Não é lentidão — é o processo Node do build
morrendo por falta de RAM tentando converter ~200MB de binário pra base64
de uma vez, dentro do bundler (Rollup/Nitro). Isso quebra o build **local**;
nem chegaria a ser testado no Vercel.

**Decisão**: revertido tudo (código, `vendor/`, dependências). Campo
"Vídeo de referência" desabilitado na UI (`src/routes/index.tsx`) com
texto explicando o motivo, e trava correspondente no servidor
(`src/server/pipeline.functions.ts` — `runContentPipeline` rejeita com
mensagem clara se vier `referenceVideoUrl`, em vez de deixar estourar erro
cru de binário ausente).

**Caminhos reais que sobram** (nenhum testado ainda, todos exigem decisão
de produto/custo, não são "ajuste rápido"):
1. Aumentar o heap do build (`--max-old-space-size`) — resolveria só o
   build local; não há garantia de que o *runtime* do Vercel aceita uma
   function desse tamanho (~250MB é o limite documentado).
2. Trocar os binários locais por uma API de extração em nuvem (serviço
   pago, novo custo recorrente).
3. Mover a Ingestão pra um ambiente separado, fora do serverless padrão
   do Vercel (ex: um worker dedicado).

**Status**: ❌ não corrigido. Desligado com clareza, documentado, Caminho B
(produto/foto/texto, sem vídeo de referência) não afetado.

---

## 3. Dívida técnica conhecida (menor, não bloqueante)

- **Cost-tracker** (`src/lib/cost-tracker.ts`) grava uso em
  `logs/usage.jsonl`, em disco local — não sobrevive a deploy serverless
  (filesystem efêmero no Vercel). Também estima o custo da OpenAI sempre
  com preço de `gpt-4o-mini`, mesmo quando o fallback chama `gpt-5`
  (mais caro) — estimativa de custo do fallback fica errada.
- Nenhum aviso na UI quando uma geração usa o fallback pago (Groq
  estourou cota) — decisão consciente de adiar.
- `.env.example` estava desatualizado (não mencionava as env vars novas
  do fallback) — já corrigido (commit `550e029`).

---

## Resumo

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | Schema inválido pra OpenAI (Teólogo/Psicologia de Compra/Ingestão) | Crítico | ✅ Corrigido |
| 2 | Ingestão depende de binários não disponíveis no Vercel | Alto | ❌ Desligado, não corrigido |
| 3 | Cost-tracker não sobrevive a serverless + preço errado no fallback | Baixo | ❌ Não corrigido |
