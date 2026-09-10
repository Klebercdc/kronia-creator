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
  types/
    taxonomy.ts        — formatos, hooks, persuasão, objetivo, modo, projeto (fechado e editável)
    evidence.ts         — fato / inferência / sugestão da IA / desconhecido
    video-analysis.ts   — saída estruturada da Ingestão
    compliance.ts       — grupos de regra versionados + resultado do gate
    pipeline.ts         — ContentRequest → ClassificationResult → FormatRecommendation → GenerationResult → PipelineOutput
  core/
    ingestion/           — README com a adaptação do Video Analyzer
    classification/       — README com a taxonomia do Content Research OS estendida
    recommendation/        — README com o diferencial central do produto
    generation/            — README com os 4 sub-agentes (Roteirista/Teólogo/Persuasão/Cinematográfico)
    compliance/             — README com o gate de validação e o teto de correção automática
```

## Status

Schema de dados e estrutura de pastas do núcleo definidos. Lógica de cada
estágio ainda por implementar — os READMEs de `src/core/*` documentam o que
cada um faz e de qual repositório auditado vem a referência.
