# Geração

Pipeline de sub-agentes, nessa ordem:

1. **Roteirista** — concept, roteiro, 5 hooks, hook nos primeiros 2–3s,
   estrutura conforme o formato recomendado. Se houver referência: adapta a
   MECÂNICA (estrutura, ritmo, hook, CTA), nunca o conteúdo literal.
2. **Teólogo** — só roda quando `request.project === "jeova_fala"`. Valida
   coerência teológica, evita doutrina inventada e citação bíblica inexistente.
3. **Persuasão** — aplica mecanismos de `taxonomy.ts` (`PERSUASION_MECHANISMS`).
   Nunca manipulação enganosa, escassez inventada ou prova social sem evidência.
4. **Cinematográfico** — roteiro aprovado → cenas, enquadramento, câmera,
   composição, prompt de vídeo.

Saída: `GenerationResult` (src/types/pipeline.ts). Toda claim sobre o produto
vai como `EvidencedClaim` — nunca texto solto sem origem rastreável.
