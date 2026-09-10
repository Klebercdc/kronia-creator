# Classificação

Consome `VideoAnalysis` (quando há referência) e devolve `ClassificationResult`
(src/types/pipeline.ts), usando a taxonomia fechada em src/types/taxonomy.ts.

Taxonomia inspirada no Content Research OS (10 técnicas de hook, formatos de
conteúdo), estendida com o vocabulário de formato do Higgsfield Marketing
Studio e do TikTok Viral Factory.

`derivedFromReference: true` quando o resultado veio de um vídeo real —
consumido pela regra de precedência em `resolveRecommendationSource`.
