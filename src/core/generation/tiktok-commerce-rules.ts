/**
 * Regras operacionais do TikTok pra criativos de venda (TikTok Shop) —
 * baseadas em diretrizes públicas do TikTok for Business/Creative Center e
 * estudos de mercado (Kantar, Ipsos, MarketCast) sobre formato de vídeo
 * curto vertical. Reaproveitado pelo Marketing/Persuasão/Cinematográfico
 * quando `mode === "tiktok_shop"`, em vez de cada agente reinventar
 * critério próprio de ritmo/densidade — fonte única, como CREATIVE_QUALITY_BAR.
 */
export const TIKTOK_COMMERCE_RULES = `REGRAS OPERACIONAIS DO TIKTOK SHOP (fonte: diretrizes TikTok for
Business/Creative Center + estudos de mercado sobre vídeo curto vertical):
- O hook precisa decidir a atenção entre 0-3s; até 6s é a janela absoluta antes de perder a
  maioria de quem ia passar o vídeo — não "esquente" antes disso.
- Estrutura de 3 partes: GANCHO (quebra o scroll) → CORPO (demonstração/prova real do produto) →
  FECHAMENTO (CTA claro, sem ambiguidade sobre o que fazer a seguir).
- Formato vertical 9:16 — mantenha elementos essenciais (rosto, produto, texto) fora das "safe
  zones" que ficam cobertas pela UI do TikTok (topo e base da tela, faixa lateral direita onde
  ficam like/comentar/compartilhar).
- Texto na tela: ritmo de leitura de ~5-10 palavras por segundo de exposição — texto que fica
  menos tempo que isso na tela não dá pra ler, é desperdício.
- Um vídeo isolado cansa rápido (fadiga criativa) — pense nesse roteiro como 1 de um conjunto de
  3-5 variações do mesmo produto, não a peça única definitiva; se o roteiro tiver um mecanismo
  (hook/ângulo) genérico o bastante pra não se diferenciar de uma variação óbvia, isso é sinal de
  fraqueza, não de "resposta segura".`;

/** Checklist final — pra revisão humana antes de publicar, não pro roteiro em si (não é regra que
 * a LLM aplica sozinha, é o que o usuário confere manualmente no app). Mantido aqui, junto da
 * fonte, pra não divergir se as regras acima mudarem. */
export const TIKTOK_PUBLISH_CHECKLIST = [
  "Hook decide a atenção nos primeiros 3s (até 6s no limite)?",
  "Formato 9:16, elementos essenciais fora das safe zones?",
  "Produto aparece em uso de verdade, não só descrito?",
  "CTA final é claro e de fricção zero (aponta pro carrinho/link dentro do app)?",
  "Texto na tela dá tempo de leitura (~5-10 palavras/segundo de exposição)?",
  "Áudio funciona mesmo sem legenda (a fala carrega o sentido sozinha)?",
  "Nenhuma claim sem evidência real do produto?",
  "Roteiro se diferencia de um genérico do mesmo nicho, ou serviria pra qualquer produto parecido?",
] as const;
