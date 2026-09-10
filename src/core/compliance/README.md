# Compliance

Gate de validação, não um prompt final. Ver `RULE_GROUPS` em
src/types/compliance.ts — inclui `originalidade_anti_copia`, que verifica
programaticamente (ex: overlap de n-gramas) se o roteiro gerado não colou
texto literal do vídeo de referência.

Fluxo: Geração → Compliance → aprovado? Sim → entrega. Não → correção →
Compliance de novo, até `maxAutoAttempts` (2) — depois escala para edição
manual do usuário. Nunca loop infinito.

Cada violação carrega `flaggedText`, `reason` e `suggestion` — o usuário vê
exatamente o que falhou e por quê, nunca uma reprovação genérica.
