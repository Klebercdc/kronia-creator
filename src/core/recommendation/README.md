# Recomendação

O diferencial central do produto — não existe em nenhum dos repositórios
auditados (Higgsfield, ClipCat, TikTok Viral Factory, Content Research OS).

Entrada: `ContentRequest` + `ClassificationResult | null`.
Saída: `FormatRecommendation` (src/types/pipeline.ts).

Regras:
- Com referência: o formato extraído na Classificação é a âncora; a
  Recomendação lista alternativas em volta dele.
- Sem referência: decide sozinha a partir de `productInfo` + `objective` + `mode`.
- `confidence` é sempre qualitativo (alta/media/baixa) até existir um loop
  de feedback com performance real de vídeos publicados — nunca virar
  percentual sem dado estatístico por trás.
