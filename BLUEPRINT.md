# KRONIA CREATOR
## PRODUCT BLUEPRINT & ARCHITECTURE CONSTITUTION

> Documento de referência-mestre. Gerado a partir da "Planta Mestra" fornecida
> pelo proprietário do produto, confrontada linha a linha com o estado real
> do repositório em `2026-09-12`. Nenhum código foi alterado para produzir
> este documento. Toda afirmação abaixo está marcada como:
>
> - **[EXISTENTE]** — implementado e verificado no código atual.
> - **[PLANEJADO]** — schema/estrutura já existe no código, mas não está
>   totalmente ligado de ponta a ponta (ou está atrás de um flag/rota não
>   exposta ao usuário final).
> - **[FUTURO]** — não existe nenhum código; é intenção da planta mestra.
> - **[NÃO DEFINIDO]** — a planta mestra não decide, e o código também não
>   resolve isso ainda; precisa de decisão explícita antes de implementar.
>
> Fonte de verdade sempre que houver conflito: o **código**, não este
> documento nem a planta mestra. Quando este documento e o código
> divergirem no futuro, o código vence e este documento deve ser atualizado
> — nunca o contrário.

---

## 1. Visão do produto

KRONIA Creator é uma inteligência especializada em TikTok — crescimento,
monetização, TikTok Shop e produção de conteúdo com IA generativa — não um
gerador de texto, roteiro, prompt ou vídeo isolado. **[FUTURO quanto ao
posicionamento completo]**: hoje o produto entrega de forma real e testada
uma fatia desse todo (ver seção 4); o resto (growth, monetização como
sistema, TikTok Shop como inteligência própria) é direção declarada, não
capacidade construída.

## 2. Posicionamento

**[EXISTENTE, parcial]** O núcleo já resolve "como transformar uma ideia
de produto em roteiro + direção visual + prompt pronto pra Veo/Flow, com
compliance e qualidade validados". **[FUTURO]** "inteligência que acompanha
o criador do perfil à venda" — não há hoje nenhuma leitura de perfil real
de TikTok, métricas de desempenho, nem malha de decisão comercial além do
pipeline de geração.

## 3. Público-alvo

**[NÃO DEFINIDO explicitamente em código ou planta]** — a planta descreve o
usuário pelos objetivos (crescer, vender, monetizar), não por segmento
(criador solo? agência? loja de TikTok Shop?). `PROJECTS = ["comercial",
"jeova_fala"]` (`src/types/taxonomy.ts:99`) mostra que o produto hoje foi
construído em cima de **dois verticais concretos e nomeados**, não de um
público genérico — isso é uma decisão de produto já tomada e deve ser
preservada, não generalizada silenciosamente.

## 4. Problema

**[EXISTENTE]** Problema resolvido hoje, ponta a ponta, com dado real: dado
um produto/ideia (com ou sem vídeo de referência), gerar um roteiro
persuasivo, tecnicamente correto (Product Truth, compliance, qualidade) e
pronto para execução visual (prompt/flowSegments), sem o usuário precisar
saber engenharia de prompt.

**[FUTURO]** Problema maior da planta: "eu não sei o que postar / por que
meu TikTok não cresce / como transformar audiência em venda" — isso exige
Expert Analyst + Deep Profile (seção 21), que não existe.

## 5. Proposta de valor

**[EXISTENTE]** "Você descreve o produto, o KRONIA decide formato, escreve,
dirige visualmente e audita — sem clichê, sem afirmação inventada, sem
sair do compliance do TikTok — e te entrega um prompt pronto pra colar no
Veo/Flow."

**[FUTURO]** "…e te diz por que seu conteúdo não está performando e o que
fazer a seguir" — não existe hoje nenhuma ingestão de métrica de
performance real do TikTok (visualizações, retenção, conversão).

## 6. Arquitetura macro

A planta descreve uma árvore conceitual (KRONIA → TikTok Intelligence →
{Growth, Monetização, Shop} → Creative Intelligence → {Conteúdo, Prompts,
Visual} → Expert Analyst → Deep Profile → Quality Engine → Core). Mapeando
contra o código real:

```
KRONIA CORE                              [EXISTENTE, parcial]
 ├─ Job Engine (core/jobs/)              [EXISTENTE]
 ├─ decisionLog (core/generation/decision-log.ts) [EXISTENTE]
 ├─ Product Truth (types/evidence.ts)    [EXISTENTE]
 └─ Creator DNA (intelligence/memory/)   [EXISTENTE, determinístico]

TIKTOK INTELLIGENCE                      [PLANEJADO/FUTURO]
 ├─ taxonomia de formato/hook/persuasão  [EXISTENTE] (types/taxonomy.ts)
 ├─ TikTok Shop como modo de geração     [EXISTENTE, raso] (mode="tiktok_shop")
 ├─ Growth (métricas, crescimento real)  [FUTURO]
 └─ Monetização como sistema próprio     [FUTURO]

CREATIVE INTELLIGENCE                    [EXISTENTE, avançado]
 ├─ Cadeia de Geração (6 agentes)        [EXISTENTE]
 ├─ Creative Reasoning/Spec/Compiler/QC  [EXISTENTE] (intelligence/creative/)
 ├─ Opportunity Engine                   [EXISTENTE] (intelligence/opportunities/)
 └─ Trend Interpreter                    [EXISTENTE] (intelligence/trends/)

EXPERT ANALYST / DEEP PROFILE            [FUTURO] (zero código)

QUALITY ENGINE                           [EXISTENTE] (quality-judge.ts)
COMPLIANCE                               [EXISTENTE] (core/compliance/)
```

A planta pede para não transformar cada caixa em agente — o código atual
já segue esse princípio: Creative Reasoning é 1 chamada (não 4 agentes
separados por Pattern/Mechanic/Shot/Director), Format Intelligence é tabela
estática (`format-knowledge.ts`), não agente.

## 7. Mapa de módulos (por pasta real)

| Pasta | Papel | Status |
|---|---|---|
| `core/jobs/` | Job Engine (fila/lease/steps) | **[EXISTENTE]** |
| `core/ingestion/` | Download+transcrição+visão de vídeo de referência | **[EXISTENTE]** |
| `core/classification/` | Classifica vídeo de referência na taxonomia | **[EXISTENTE]** |
| `core/recommendation/` | Recomenda formato | **[EXISTENTE]** |
| `core/generation/` | Cadeia de 6 agentes de roteiro/direção | **[EXISTENTE]** |
| `core/compliance/` | Gate de aprovação (IA + guards determinísticos) | **[EXISTENTE]** |
| `core/intelligence/opportunities/` | Opportunity Engine (o que criar) | **[EXISTENTE]** |
| `core/intelligence/trends/` | Interpretação de tendência (1 chamada LLM) | **[EXISTENTE]** |
| `core/intelligence/memory/` | Creator DNA (padrões do histórico, determinístico) | **[EXISTENTE]** |
| `core/intelligence/creative/` | Creative Spec → Target → Compiler → QC → Prompt final | **[EXISTENTE]** |
| `server/*.functions.ts` | RPCs expostas ao cliente | **[EXISTENTE]** |
| `routes/index.tsx` | UI (5 abas: Criar/Histórico/Explorar/Prompt/Perfil) | **[EXISTENTE, parcial]** |
| Expert Analyst | — | **[FUTURO]**, nenhuma pasta existe |
| Billing/Plano Max | — | **[FUTURO]**, nenhuma pasta existe |

## 8. Mapa de inteligência (chamadas reais a LLM, hoje)

Cada uma é **1 chamada** `callStructuredText`/`callStructuredVisionFromDataUrls`
(princípio "1 chamada gera, 1 checagem audita" já em vigor):

1. Ingestão → visão computacional do vídeo de referência (`ingestion/analyze.ts`)
2. Classificação do vídeo de referência
3. Recomendação de formato
4. Roteirista
5. Marketing
6. Teólogo (condicional — `shouldRunTeologo()`)
7. Psicologia de Compra
8. Persuasão
9. Cinematográfico (+ 1 retry determinístico de estrutura, sem LLM extra na maioria dos casos)
10. Quality Judge (inicial e final)
11. Quality Revise (condicional)
12. Compliance (validate + copyright-check em paralelo)
13. Compliance Correct (condicional, até 2 tentativas)
14. SEO (sob demanda, fora da cadeia principal)
15. Opportunity Engine (`intelligence/opportunities/engine.ts`)
16. Trend Interpreter (`intelligence/trends/interpreter.ts`)
17. Creative Reasoning (`intelligence/creative/reasoning.ts`)
18. Creative Repair (`intelligence/creative/repair.ts`, condicional)

**[NÃO DEFINIDO]** a planta pede fusão de Psicologia+Persuasão em algum
momento futuro — isso foi tentado e **revertido nesta mesma sessão** por
instrução explícita do proprietário ("Pare... não implemente a fusão
agora"). Continua sendo os 2 agentes separados. Qualquer reabertura desse
tópico precisa de decisão explícita nova.

## 9. Mapa de especialistas (Experts internos, seção 16 da planta)

| Expert da planta | Existe no código? | Onde |
|---|---|---|
| Marketing | ✅ **[EXISTENTE]** | `generation/marketing.ts` |
| Psychology of Buying | ✅ **[EXISTENTE]** | `generation/psicologia-compra.ts` |
| Persuasion | ✅ **[EXISTENTE]** | `generation/persuasao.ts` |
| Copywriter/Scriptwriter | ✅ **[EXISTENTE]**, fundido | `generation/roteirista.ts` |
| Cinematic Director | ✅ **[EXISTENTE]** | `generation/cinematografico.ts` |
| Compliance | ✅ **[EXISTENTE]** | `compliance/validate.ts` + guards |
| Quality Judge | ✅ **[EXISTENTE]** | `generation/quality-judge.ts` |
| Product Truth | ✅ **[EXISTENTE]**, é um tipo/contrato, não agente | `types/evidence.ts` |
| Creative Director | ⚠️ **[PLANEJADO]** | `intelligence/creative/reasoning.ts` decide pattern/mechanic/shot, mas não gera "3 territórios" nem julgamento de território (ver seção 13 da planta original — não implementado) |
| Platform Intelligence | ⚠️ **[PLANEJADO]** | `intelligence/creative/target-profiles.ts` (Veo/Flow/Kling, model≠platform) |
| Research | ❌ **[FUTURO]** | sem web search real conectado ao pipeline |
| Consumer Intelligence | ❌ **[FUTURO]**, seria redundante com Psychology of Buying — avaliar antes de criar |
| Teólogo (vertical específico, não está na lista da planta) | ✅ **[EXISTENTE]** | `generation/teologo.ts` — decisão de produto já tomada, preservar |

## 10. Creative Engine

**[EXISTENTE]** Já é exatamente o que a seção 7/9 da planta pede: entende
objetivo → produto → contexto → território (via `CreativeSpec`) antes de
gerar. Fluxo real implementado em `core/intelligence/creative/`:

```
generateCreativeSpec (reasoning.ts, 1 chamada LLM)
  → evaluateCreativeSpec (evaluation.ts, reaproveita o reasoning, sem chamada extra)
  → resolveTarget (target-resolver.ts — USER_SELECTED ou DEFAULT_TARGET)
  → target-specialists.ts (função determinística por target)
  → compilePrompt (compiler.ts, puro, sem LLM)
  → runPromptQc (qc.ts, determinístico)
  → repairPrompt (repair.ts, 1 chamada LLM condicional, teto 2 tentativas)
```

Exposto ao usuário via aba **"Prompt"** na UI e RPC `buildCreativePromptFn`
(`server/creative.functions.ts`). **[PLANEJADO]** `AUTOMATIC_TARGET_SELECTION`
existe no enum (`TargetSelectionModeSchema`) mas sem lógica de ranking —
contrato pronto, comportamento não implementado (decisão consciente,
documentada no próprio schema).

## 11. TikTok Intelligence

**[EXISTENTE, raso]** `MODES = ["tiktok_shop", "organico"]`,
`CONTENT_FORMATS` (14 formatos fechados), `HOOK_TYPES` (12, baseados em
análise de 34.635 clipes reais conforme comentário em `classify.ts`).

**[FUTURO]** tudo que depende de dado vivo da plataforma: tendências atuais
via busca real, mudanças de política do TikTok, análise de desempenho real
de conteúdo publicado. Hoje `interpretTrend` (`trends/interpreter.ts`) é 1
chamada LLM sem acesso a busca externa — **risco identificado na seção 21
da planta ("internet ≠ autoridade")**: não há pesquisa web conectada a
nenhum agente hoje.

## 12. Monetização

**[FUTURO]** Não existe conceito de monetização como sistema (assinatura,
métricas de receita, funil) no código. O único artefato relacionado é
`mode: "tiktok_shop"` influenciando o CTA gerado ("carrinho amarelo") —
é geração de conteúdo com viés comercial, não uma camada de monetização.

## 13. TikTok Shop

**[EXISTENTE, raso]** Um valor de enum (`mode="tiktok_shop"`) que muda o
CTA e o tom do Marketing/Persuasão. **[FUTURO]** qualquer integração real
com TikTok Shop (catálogo, preço, disponibilidade, afiliação).

## 14. AI Prompt Engine

**[EXISTENTE]** Esta é a capacidade mais madura do produto hoje fora da
geração de roteiro. `PromptArtifactSchema` (`creative/schemas.ts:282`)
carrega prompt final + negativo + QC + versão + target. Cobre praticamente
toda a lista de campos técnicos que a seção 9 da planta pede (câmera,
lente, iluminação, movimento, continuidade, restrições) — ver `DirectorSpecSchema`,
`ShotSchema`, `ImageSpecSchema`, `VideoSpecSchema`, `DialogueSpecSchema`
em `creative/schemas.ts`.

## 15. Image Intelligence

**[EXISTENTE, schema pronto]** `ImageSpecSchema` existe e é usado pelo
Creative Reasoning quando `media: "image"`. **[NÃO TESTADO neste
documento]** — não foi executado um teste real de ponta a ponta pra modo
imagem durante esta auditoria; comportamento no papel, não confirmado ao
vivo.

## 16. Video Intelligence

**[EXISTENTE, robusto, testado com IA real nesta sessão]** Cadeia completa
Roteirista→...→Cinematográfico produz `flowSegments` (blocos de exatos
10s para o Google Flow/Veo) com checagem determinística de:
- timing (sem gap, sem sobreposição, contagem de blocos correta) — `flow-segment-validator.ts`
- estrutura narrativa gancho→desenvolvimento→cta quando duração é múltiplo de 30s
- fórmula de hero shot como campo estruturado (`heroShotFormula`/`customHeroShotFormulaLabel`)

**Regra "HOOK = primeiros 2 segundos"** (seção 11 da planta): **[EXISTENTE]**,
`roteirista.ts` já implementa isso (linha 13-36 conforme `ARCHITECTURE.md`).
Confirmado: não foi alterada nesta sessão, nem deve ser sem decisão explícita.

## 17. Product Truth

**[EXISTENTE]** Já é lei no código, não sugestão — `EvidencedClaim`
(`types/evidence.ts`) com `kind: "fato" | "inferencia" | "sugestao_ia" |
"desconhecido"`. Regra "produto é fato, cena é criatividade" da planta é
aplicada em múltiplas camadas independentes (defesa em profundidade):
1. Prompt de cada agente ("nunca invente característica fora das claims")
2. `numeric-guard.ts` — todo número narrado precisa existir numa claim `fato`
3. `absolute-claims-guard.ts` — lista fixa de frases banidas
4. Compliance via LLM (grupo `claims_produto`, `promessas_nao_comprovadas`)
5. `ProductCapabilityMapSchema` (creative/schemas.ts) — mapeamento formal sobre `EvidencedClaim`

Verificado ao vivo nesta sessão (caso real "anel JESUS"): quando o
Marketing/Persuasão extrapolou "resistente à água" para "resiste a toda
situação da vida", o Compliance pegou e reprovou — nunca aprovou
silenciosamente.

## 18. Compliance

**[EXISTENTE]** `RULE_GROUPS` (`types/compliance.ts`) já separa exatamente
as categorias que a seção 19 da planta pede: risco legal/política
(`regras_tiktok`, `linguagem_proibida`), afirmação não sustentada
(`promessas_nao_comprovadas`), afirmação absoluta (`afirmacoes_absolutas`),
clichê (`cliche_generico`), originalidade (`originalidade_anti_copia`),
IP (`propriedade_intelectual`). Nunca aprova por padrão — precisa
`approved: true` explícito; teto de correção automática
(`MAX_AUTO_COMPLIANCE_ATTEMPTS`) escala para revisão manual em vez de
mascarar reprovação.

## 19. Quality Engine

**[EXISTENTE]** `quality-judge.ts` avalia 4 eixos (especificidade,
naturalidade, persuasão, aderência ao produto) — não é aprovação cega,
`verdict` é calculado em **código** (média<8 OU qualquer eixo<7), nunca a
própria chamada que gerou o texto se autoavalia. Roda 2 vezes: logo após
Cinematográfico e de novo depois do Compliance (avalia o texto que
realmente vai ser entregue).

**[NÃO DEFINIDO]** a planta pede explicação estruturada tipo
"PROBLEMA→MOTIVO→CORREÇÃO" quando reprova — hoje o Quality Judge devolve
`revisionInstruction` (texto), que cumpre a função mas não está formalizado
como 3 campos separados. Melhoria de baixo risco, não implementada.

## 20. DecisionLog

**[EXISTENTE]** Exatamente como a seção 17 da planta descreve — cada
agente "pensante" (Recomendação, Roteirista, Marketing, Teólogo, Psicologia,
Persuasão, Cinematográfico) acrescenta 1 entrada
`{agente, decisao, motivo, alternativasDescartadas?}`, nunca reescreve
entrada de outro agente. Implementado como extensão transiente do output
de cada LLM (`decisaoResumo`/`motivoDecisao`), nunca pedindo pra LLM
reescrever o array acumulado inteiro (evita corrupção/perda de histórico).

**Limitação real, verificada ao vivo nesta sessão**: a especificidade do
texto do `decisionLog` depende de a LLM seguir bem a instrução — quando
isso importava de forma binária (qual fórmula visual de hero shot foi
usada), a solução foi tirar do texto livre e transformar em campo
estruturado (`heroShotFormula`). **Fica registrado como padrão a seguir**:
toda decisão que precisa ser auditável de forma confiável deveria ser campo
estruturado, não só prosa dentro do decisionLog.

## 21. Expert Analyst

**[FUTURO]** Zero código. Nenhuma pasta, tipo ou RPC relacionada a análise
de perfil, diagnóstico estratégico ou consultoria. A aba "Perfil" na UI é
um placeholder textual ("Em breve: atores salvos, preferências e
configurações da conta") — nem o escopo declarado no placeholder é o do
Expert Analyst da planta.

## 22. Plano Max

**[FUTURO]** Nenhum código de billing, plano, assinatura ou feature-gate
encontrado no repositório inteiro.

## 23. UX futura

**[EXISTENTE, parcial]** 5 abas reais: Criar, Histórico, Explorar, Prompt,
Perfil (placeholder). "Explorar" já é o Opportunity Engine funcionando
(não placeholder). A experiência de conversa única (seção 22/23 da planta
— "usuário sente que fala com 1 inteligência") **[FUTURO]** — a UI atual é
formulário + cards por etapa, não um chat conversacional.

## 24. Fluxos principais

1. **Criar por ideia/produto** (Caminho B): formulário → `runContentPipeline`/Job Engine → roteiro + flowSegments. **[EXISTENTE]**
2. **Criar por vídeo de referência** (Caminho A): upload/URL → Ingestão (Job Engine) → Classificação → resto igual ao Caminho B. **[EXISTENTE]**
3. **Explorar oportunidades**: Opportunity Engine → escolher oportunidade → vira seed pro fluxo de Criar. **[EXISTENTE]**
4. **Gerar prompt (aba Prompt)**: ideia/produto → CreativeSpec → prompt final pronto pra colar em Veo/Flow/Kling. **[EXISTENTE]**
5. **Refinar cena pontual**: `refineScene` RPC. **[EXISTENTE]**
6. **Gerar legenda/hashtags sob demanda**: `generateSeoPackage`. **[EXISTENTE]**
7. **Analisar perfil / diagnosticar estratégia**: **[FUTURO]**, não existe.

## 25. Ordem de implementação (conforme seção 24-27 da planta)

A planta define: Fase 1 Inteligência → Fase 2 Layout → Fase 3 Expert
Analyst → Fase 4 Evolução/Aprendizado.

**Estado real:** o projeto está avançado dentro da própria Fase 1
(Inteligência) — geração, compliance, quality, creative/prompt engine e
opportunity engine já maduros e testados com IA real — mas **ainda não
fechada**: Correção 6 desta mesma sessão (especificidade do decisionLog do
Cinematográfico) é exemplo de item de Fase 1 ainda sendo endurecido. A UI
(Fase 2) já tem uma versão funcional, não é redesenho pendente — o "layout"
existente é utilitário, não necessariamente o "premium, simples e natural"
que a seção 26 da planta descreve; avaliação de UX/visual está fora do
escopo desta auditoria (não sou capaz de avaliar isso sem rodar a app
visualmente). Fase 3 (Expert Analyst) e Fase 4 (Evolução/Aprendizado
contínuo) — **[FUTURO]**, zero código.

## 26. Dependências entre módulos

- Expert Analyst (Fase 3) depende de: Deep Profile (dado real de TikTok,
  não existe fonte), Performance Learning (não existe), e da Inteligência
  atual como consumidora (reaproveitar Opportunity Engine + Creative Engine
  — não duplicar).
- Creative Engine já depende do Product Truth (`EvidencedClaim`) — qualquer
  novo produtor de claim (ex: análise de imagem de produto) deve alimentar
  o mesmo contrato, nunca criar um paralelo.
- Job Engine é pré-requisito de qualquer nova capacidade "longa" (>60s) —
  já provado com Ingestão e Geração; Expert Analyst provavelmente também
  precisará dele se envolver análise de vídeo/perfil.

## 27. Contratos entre camadas

- `GenerationResult` (`types/pipeline.ts`) é o objeto mutável único que
  atravessa toda a Geração — nenhuma camada deveria inventar um objeto
  paralelo.
- `EvidencedClaim` é o único contrato de evidência — `ProductCapabilityMapSchema`
  do Creative Engine é uma **view** sobre ele, não um contrato paralelo
  (decisão já documentada em código).
- `ComplianceViolation`/`RULE_GROUPS` é o único contrato de violação —
  guards determinísticos e o LLM de compliance escrevem no mesmo formato.
- `CreativeSpec` é o contrato entre Creative Reasoning e tudo que vem
  depois (Target Resolver, Specialist, Compiler, QC) — media-agnóstico
  (`image`/`video`) desde o desenho.

## 28. O que pertence a cada fase

**Fase 1 (atual):** tudo em `core/generation`, `core/compliance`,
`core/intelligence/*`, `core/jobs`, seus schemas em `types/`, e as RPCs que
os expõem. Ainda em aberto dentro da Fase 1: robustecer decisionLog
(padrão "campo estruturado > prosa" da seção 20), avaliar Image/Video
Intelligence com teste real de imagem (não só vídeo).

**Fase 2 (layout):** já existe uma versão funcional da UI — decisão a
tomar é se o "layout" da planta significa redesenho visual (fora do
escopo técnico desta auditoria) ou reorganização de fluxo — **[NÃO
DEFINIDO]**.

**Fase 3 (Expert Analyst):** não iniciar até Fase 1/2 estarem
"suficientemente maduras" segundo a própria planta (seção 27) — hoje não
estão (decisionLog ainda sendo corrigido nesta mesma sessão).

**Fase 4 (evolução/aprendizado contínuo):** `creator-dna.ts` é a única
peça que já aponta nessa direção (padrões determinísticos sobre
histórico) — mas é insumo, não o sistema de aprendizado em si.

## 29. O que NÃO pertence a cada fase (reforço da seção 28 da planta)

Confirmado pelo código atual, nada disso foi violado nesta sessão:
- Nenhum agente novo criado "por organização visual" — Psicologia e
  Persuasão continuam 2 agentes porque a fusão foi revertida por decisão
  explícita, não porque "menos agentes é sempre melhor" sem critério.
  Compliance e Quality Judge continuam separados por bom motivo (avaliam
  eixos diferentes: risco legal vs. qualidade criativa).
- Nenhuma tabela nova de banco criada nesta sessão nem nas anteriores
  documentadas.
- Nenhuma mudança de posicionamento pra "IA que faz tudo".

## 30. Regras de controle de escopo

A checklist de 9 perguntas da seção 29 da planta é compatível com o que
já rege este repositório de fato (ver `CLAUDE.md`/instruções do usuário:
"preservar contratos, não modificar fora do escopo, evitar duplicação").
**Recomendação**: formalizar essa checklist como parte do processo de
review de qualquer PR/tarefa nova neste repositório, já que hoje ela existe
só na cabeça do proprietário e nesta planta, não em nenhum arquivo do
repo (`CONTRIBUTING.md` não existe).

## 31. Princípios arquiteturais (confirmados no código)

- **1 chamada LLM gera, 1 checagem (código ou outra chamada) audita** —
  em vigor desde o incidente real do "anel JESUS" (LLM trocou "pensar" por
  "refletir" pra escapar de um ban de clichê baseado só em instrução).
  Todo guard determinístico deste repo (`numeric-guard`, `absolute-claims-guard`,
  `cliche-guard`, `flow-segment-validator`) existe por causa desse
  princípio.
- **Zod como contrato runtime, nunca `as unknown as X`** — confirmado em
  todos os schemas revisados nesta auditoria.
- **Nenhuma tabela nova sem necessidade comprovada** — Opportunity Engine
  e Creative Engine não persistem resultado; só viram dado permanente
  quando o usuário decide "Criar conteúdo" (`creator_history`).
- **Campo estruturado > prosa livre quando a decisão precisa ser confiável**
  — princípio novo, extraído do trabalho desta sessão (seção 20 acima),
  vale a pena adotar formalmente daqui pra frente.

## 32. Critérios de qualidade

Já em vigor via Quality Judge (especificidade/naturalidade/persuasão/
aderência ao produto) + `CREATIVE_QUALITY_BAR` (bloco de prompt
compartilhado, banindo frases genéricas, testando especificidade contra
"serviria pra 100 produtos do nicho?"). **[NÃO DEFINIDO]** critério de
qualidade formal para Image Intelligence (schema existe, não foi testado
com caso real nesta auditoria).

## 33. Critérios de aceite

Nesta sessão, o padrão usado (e que deveria virar convenção documentada)
foi: `npx tsc --noEmit` limpo + `npm run build` limpo + `npm run
smoke-test:offline` limpo + testes determinísticos novos passando + **pelo
menos 1 execução real via Job Engine com custo real de tokens**,
verificada campo a campo, não só "rodou sem erro". Reprovar explicitamente
("FASE 1 NÃO FECHADA") quando algo não se sustenta é aceito e esperado —
não existe pressão pra "sempre fechar verde".

## 34. Roadmap estrutural (proposto, não decidido)

1. Fechar de vez a Fase 1: robustecer os pontos de "prosa não confiável"
   restantes no decisionLog fora do Cinematográfico (não auditado nesta
   sessão), testar Image Intelligence com caso real.
2. Decidir explicitamente o escopo de "Fase 2 — Layout" (redesenho visual
   vs. reorganização de fluxo).
3. Só depois disso, desenhar o contrato de dados do Expert Analyst (que
   fontes de perfil/performance reais estarão disponíveis — hoje nenhuma).
4. Evolução/aprendizado contínuo (Fase 4) fica condicionada a ter dado
   real de performance entrando no sistema, que hoje não existe.

## 35. Estado atual do projeto (resumo executivo)

**Forte e testado com IA real:** pipeline de geração completo (6 agentes),
compliance (guards determinísticos + LLM), Quality Judge duplo,
DecisionLog, Job Engine (2 kinds: ingestão e geração), Creative/Prompt
Engine (Spec→Target→Compiler→QC→Prompt), Opportunity Engine.

**Existe mas não verificado nesta auditoria:** Image Intelligence
(schema pronto, sem teste real de imagem), Trend Interpreter (sem
verificação de qualidade real do output).

**Não existe:** Expert Analyst, Deep Profile, Plano Max/billing, growth
real (métricas de TikTok), monetização como sistema, TikTok Shop como
integração real (só como modo de geração), UX conversacional.

## 36. Próximas etapas (sugeridas, aguardando decisão do proprietário)

1. Decidir se o Correção-6-style "campo estruturado > prosa" deve ser
   aplicado retroativamente a outros pontos do decisionLog (Marketing,
   Persuasão, etc.) ou fica restrito ao caso já corrigido.
2. Rodar um teste real de Image Intelligence (hoje só verificado por
   leitura de schema, não por execução).
3. Definir o que "Fase 2 — Layout" significa concretamente antes de
   qualquer trabalho de UI maior.
4. Não iniciar Expert Analyst sem antes decidir de onde viria o dado real
   de perfil/performance do TikTok (não existe conector hoje).

## 37. Riscos arquiteturais

- **Dupla manutenção de pipeline**: existe um pipeline síncrono
  (`core/pipeline.ts`, usado por smoke-test) e um assíncrono via Job
  Engine (`core/jobs/content-generation.ts`, usado pela UI real) — ambos
  chamam as mesmas funções de `core/generation`, mas qualquer mudança de
  orquestração (ordem de agentes, novos steps) precisa ser replicada nos
  dois. Risco confirmado nesta sessão (a fusão Persuasão+Psicologia exigiu
  tocar os dois antes de ser revertida).
- **Cost-tracker não sobrevive a serverless** (documentado em
  `ARCHITECTURE.md`) — custo real por chamada não é confiável em produção
  Vercel hoje.
- **Cliché-guard é léxico, não semântico** — documentado e aceito por
  desenho (não é bug), mas é um limite real: variação de frase fora da
  lista de padrões passa despercebida.
- **Confiabilidade de instrução em prosa livre da LLM** — verificado ao
  vivo nesta sessão (decisionLog do Cinematográfico não nomeava a fórmula
  mesmo pedido explicitamente 2x) — qualquer decisão que precise ser
  auditável com certeza deve virar campo de schema, não só instrução de
  prompt.

## 38. Decisões já tomadas (preservar, não reabrir sem motivo explícito)

- Provider único: OpenAI (Groq removido por instabilidade de cota).
- `PROJECTS = ["comercial", "jeova_fala"]` como os 2 verticais do produto.
- HOOK = primeiros 2 segundos, não mexer casualmente.
- Não fundir Psicologia de Compra + Persuasão agora (revertido nesta
  sessão por instrução explícita).
- Sem tabela nova de `creative_prompts`/persistência de PromptArtifact por
  enquanto — devolvido ao cliente, só vira histórico permanente se o
  usuário "Criar conteúdo".
- `AUTOMATIC_TARGET_SELECTION` fica só no contrato (enum), sem lógica de
  ranking implementada — decisão consciente, não lacuna esquecida.
- Target Specialists são 100% determinísticos na fase atual
  (`implementation: "deterministic"`), com contrato aberto pra
  `"llm"/"hybrid"` no futuro.

## 39. Decisões ainda abertas

- Escopo exato de "Fase 2 — Layout" (seção 25 acima).
- Se o padrão "campo estruturado > prosa" deve virar regra geral do
  decisionLog ou ficar pontual.
- De onde virá o dado real de perfil/performance do TikTok para o Expert
  Analyst (nenhum conector hoje — API oficial do TikTok? scraping? input
  manual do usuário?).
- Se "Explorar" (Opportunity Engine) e "Prompt" (Creative Engine) devem se
  fundir conceitualmente em algum momento ou continuam abas paralelas.

## 40. Glossário

- **Product Truth**: regra de que características reais do produto
  (`EvidencedClaim` kind="fato") nunca podem ser contradicta ou
  extrapoladas pela criatividade.
- **DecisionLog**: histórico append-only de decisões de cada agente
  pensante, nunca reescrito por agentes seguintes.
- **flowSegments**: blocos de exatos 10 segundos, unidade de submissão do
  Google Flow/Veo.
- **CreativeSpec**: contrato universal (media-agnóstico) que sai do
  Creative Reasoning e atravessa Target Resolver → Specialist → Compiler → QC.
- **Target (model vs. platform)**: `model` é o gerador subjacente (Veo,
  Kling); `platform` é um workflow sobre um ou mais models (Flow sobre
  Veo+Imagen+Gemini, com camadas próprias como SceneBuilder).
- **Job Engine**: fila de jobs com claim atômico e lease, usado só para
  trabalho realmente longo (vídeo, cadeia de geração) — nunca para
  chamadas síncronas curtas.
- **Guard determinístico**: checagem em código puro (sem LLM) que audita
  a saída de uma chamada de LLM anterior — nunca substitui o julgamento da
  LLM, só verifica um subconjunto mecanicamente checável.

---

*Documento gerado por auditoria de código real em `2026-09-12`. Não
substitui a Planta Mestra original (mantida como fonte de intenção do
proprietário) — este arquivo é o cruzamento entre intenção e realidade, e
deve ser atualizado sempre que uma tarefa de desenvolvimento mudar
significativamente o que está em EXISTENTE/PLANEJADO/FUTURO.*
