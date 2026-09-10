# KRONIA — Criador Inteligente

Núcleo de inteligência de conteúdo do KRONIA: analisa vídeos de referência, classifica formato e mecânica de persuasão, recomenda o melhor formato para um produto/objetivo, gera roteiro e valida compliance antes da entrega.

Pipeline: **Ingestão → Classificação → Recomendação → Geração → Compliance**

Atende dois verticais sobre o mesmo núcleo:
- **Comercial** (TikTok / TikTok Shop) — Roteirista + Persuasão + Cinematográfico
- **Jeová Fala** (conteúdo teológico) — Roteirista + Teólogo + Persuasão + Cinematográfico

Este repositório substitui o conteúdo anterior (protótipo de app de treino/fitness) — a partir deste commit começa do zero com o escopo de Content Intelligence.

## Estrutura

```
src/
  types/                 — schemas Zod (fonte de verdade) + tipos TS inferidos
    taxonomy.ts          — formatos, hooks, persuasão, objetivo, modo, projeto (fechado e editável)
    evidence.ts          — fato / inferência / sugestão da IA / desconhecido
    video-analysis.ts    — saída estruturada da Ingestão
    compliance.ts        — grupos de regra versionados + resultado do gate
    pipeline.ts          — ContentRequest → ClassificationResult → FormatRecommendation → GenerationResult → PipelineOutput
  lib/
    llm.ts                — client Groq com saída estruturada validada por Zod (retry automático em falha de schema)
  core/
    ingestion/ingest.ts     — AINDA NÃO IMPLEMENTADO (precisa portar o pipeline Python do Video Analyzer)
    classification/classify.ts
    recommendation/recommend.ts
    generation/
      roteirista.ts · teologo.ts · persuasao.ts · cinematografico.ts · generate.ts (orquestrador)
    compliance/
      validate.ts (gate) · correct.ts (correção direcionada às violações)
    pipeline.ts            — orquestra os Caminhos A/B ponta a ponta, com teto de correção automática
```

## Rodando

```
cp .env.example .env   # preencher GROQ_API_KEY (console.groq.com/keys)
npm install
npm run typecheck
```

## Status

Schema de dados validado em runtime (Zod) e lógica de Classificação,
Recomendação, Geração (4 sub-agentes) e Compliance implementadas, chamando
Groq com saída estruturada. `npm run typecheck` passa limpo.

**Não testado com chamada real à API** nesta sessão — sem `GROQ_API_KEY`
configurada aqui. Falta: rodar de ponta a ponta com uma chave real e ajustar
os prompts a partir do resultado.

**Ingestão de vídeo (`src/core/ingestion/ingest.ts`) ainda não implementada**
— lança erro explícito. É a adaptação do pipeline Python do Video Analyzer
(download/frames/transcript), trabalho à parte do resto do núcleo em
TypeScript.
