# CASE_001 — plano de teste isolado (Gancho vs. fluxo comercial)

Decisão do usuário (v1.0) após o teste real com a imagem cristã sem
produto (PR #67/#70): **pausar antes de PR2 (Revelação)** e separar dois
controles independentes antes de continuar trocando blocos por
objetivo+estratégia.

## Por que pausar

O teste anterior (`docs/creative-engine-image-reasoning.md`) misturou
dois problemas diferentes:

- **Controle criativo** — "essa criação é boa pro contexto?" (qualidade
  do Gancho: naturalidade, especificidade, relação com a imagem).
- **Controle de dados** — "essa criação contém só informação permitida?"
  (o motor comercial inventou produto, benefício e CTA porque a imagem
  de teste não tinha produto nenhum — a ferramenta é de venda por
  natureza).

Sem separar os dois, não dá pra saber se uma regressão futura é falha de
criatividade ou vazamento de contexto/claim inventado.

## Sequência combinada

```
PR1 — Gancho (feita: #67, #70)
  ↓
Teste A — imagem cristã sem produto
  ↓
Teste B — imagem com produto real
  ↓
Validação
  ↓
PR2 — Revelação
```

## Teste A — imagem cristã sem produto (já executado)

Entrada: perfil cristão, tipo mensagem, objetivo retenção+reflexão+
compartilhamento, referência = personagem religioso em ambiente
contemplativo (sem produto comercial).

Resultado real (documentado em `creative-engine-image-reasoning.md`):
Gancho melhorou nos critérios que dependem de código (sem fórmula
antiga, timing ok, compliance ok), mas o fluxo INVENTOU produto
("mensagem de amor e esperança que transforma vidas") e CTA ("carrinho
laranja repleto de livros") — porque a ferramenta atual (Blocos de
Venda) sempre assume que existe produto. Isso não é regressão do Gancho
— é o comportamento esperado de uma ferramenta de venda usada sem
produto. Só reforça a necessidade futura do Modo Mensagem (Fase 2).

## Teste B — imagem com produto real (pendente)

Precisa de uma foto real com produto visível (embalagem/capa/
características claras) — o caso de uso normal da ferramenta.

Checklist de aprovação (marcar ao rodar):

- [ ] identifica o produto real
- [ ] preserva a aparência do produto (sem alterar características)
- [ ] não inventa produto diferente
- [ ] não inventa prova social
- [ ] não inventa números
- [ ] não inventa benefícios factuais
- [ ] produz um gancho natural
- [ ] mantém o objetivo de conversão
- [ ] mantém timing
- [ ] passa pelo judge
- [ ] fallback continua funcionando

## Regra fundamental (produto e claims)

```
REFERÊNCIA → fatos visuais
BRIEFING   → fatos fornecidos
IA         → criatividade
CÓDIGO     → validação
```

Produto observado na imagem → preservar características. Produto no
briefing → pode usar. Nem na imagem nem no briefing → não inventar.
Mesma lógica pra claims: IA cria linguagem, nunca cria fato comercial
não comprovado (ex. proibido: "Milhares de pessoas já compraram" sem
fonte; permitido: "Um devocional pensado para acompanhar seus momentos
de reflexão").

## O que não mexer nesta etapa

SemanticModel completo, Claim States completo, Global Locks, Diversity
Engine, Full Script Judge, novo Modo Mensagem, refatoração grande de UI,
mudança de todos os blocos — tudo isso é Fase 2 (ver
`creative-engine-vision.md`).

## Próxima ação

Rodar o Teste B: gerar um roteiro na ferramenta com uma foto real de
produto, marcar o checklist acima, e só então decidir sobre PR2
(Revelação).
