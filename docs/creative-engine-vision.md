# KRONIA Creator — Universal Creative Writing Engine

Especificação funcional, arquitetural e de implementação (v1.0), definida
pelo usuário como visão de longo prazo pro motor de geração do KRONIA
Creator. Guarda o roadmap completo pra evitar re-explicar em cada PR —
citar por número de seção nas descrições de PR/commit em vez de colar
o documento inteiro de novo.

## Status de implementação

- **PR1 — Gancho**: ✅ feito (PR #67, mergeada). `publico`+`valores` →
  campo único `gancho`, escrito livre pela IA (objetivo + estratégia, não
  molde fixo). Guardrails mantidos (timing, compliance, judge, fallback).
- **PR2 — Revelação**: pendente, mesmo princípio.
- **PR3 — Dor/Identificação**: pendente.
- **PR4 — Alívio/Benefício**: pendente.
- **PR5 — CTA**: pendente.
- **Fase 2** (SemanticModel, CreativeStrategy, Locks, Claim States, Full
  Script Judge, CreativeHistory, diversidade controlada, Universal
  Writing Engine multi-nicho): não começar antes de PR1-PR5 validadas em
  uso real.

## Princípio central (seção 0, 48)

IA = criatividade, narrativa, linguagem, emoção, estratégia.
Código = contrato, segurança, consistência, timing, validação, fallback.

## Regra de ouro pra cada PR (seção 34)

Nunca uma PR gigante. Cada PR: escopo único, testável, reversível,
preserva fallback, não refatora código não relacionado.

---

## Documento completo

### 0. Visão do projeto

O KRONIA Creator deve evoluir de um gerador baseado em templates rígidos
para um sistema de direção criativa assistida por IA.

O objetivo não é simplesmente gerar frases. O objetivo é compreender: o
que o usuário quer criar; para quem; com qual objetivo; em qual nicho; em
qual formato; com qual emoção; qual deve ser a progressão da mensagem;
quais elementos precisam permanecer consistentes; quais regras precisam
ser respeitadas.

A IA deve pensar criativamente. O código deve controlar o contrato.

### 1. Visão do produto

O KRONIA Creator será um ambiente universal de criação. O usuário não
precisa conhecer fórmulas de copywriting nem saber qual template
escolher — pode dizer o que quer criar em linguagem natural (ex.: "Quero
uma mensagem cristã profunda sobre esperar em Deus.", "Quero vender este
livro.", "Quero um roteiro de 20 segundos para TikTok."). O sistema
identifica a intenção e constrói a estratégia adequada.

### 2. Posicionamento

Não é só "gerador de texto" nem só "gerador de prompts". É **motor de
direção criativa**: recebe uma intenção e produz uma peça pronta pra uso.

### 3. Arquitetura central

```
INPUT → INTENT DETECTION → CONTEXT BUILDING → REFERENCE ANALYSIS → LOCKS
  → SEMANTIC MODEL → CREATIVE STRATEGY → CONTENT GENERATION
  → VISUAL/PRODUCTION DIRECTION → TIMING → COMPLIANCE → QUALITY JUDGE
  → REVISION → FINALIZER → FINAL OUTPUT
```

Não executar todas as etapas necessariamente em todos os formatos — cada
modo usa só as etapas necessárias.

### 4. Modos principais

Seleção rápida de intenção — não são templates rígidos, são instruções
de alto nível pra estratégia criativa.

**4.1 Mensagem** — criar mensagem com significado, emoção e progressão
narrativa. Estrutura padrão: Gancho → Desenvolvimento → Reflexão →
Aplicação → CTA (partes podem combinar dependendo da duração).

**4.2 Engajamento** — maximizar atenção, identificação e uma ação de
interação (curtir/comentar/compartilhar/seguir/salvar). Estrutura:
Gancho → Ideia → Desenvolvimento → CTA de engajamento.

**4.3 Vendas** — apresentar oferta/produto naturalmente. Estruturas
possíveis: Gancho → Problema → Desejo → Produto → Benefício → CTA; ou
Gancho → Revelação → Benefício → Prova verificável → CTA. Adaptativa.

**4.4 Roteiro** — sequência audiovisual: Conceito → Gancho → Cenas →
Diálogo/Narração → Desenvolvimento → Fechamento → CTA. Pode incluir
câmera, enquadramento, ação, fala, ambiente, iluminação, continuidade,
duração, áudio.

**4.5 Personalizado** — usuário explica livremente o que deseja; IA
identifica intenção, formato, público, objetivo, tom, contexto,
restrições. Não limitar a categorias pré-cadastradas.

### 5. Perfil de nicho

Usuário define um perfil criativo que funciona como contexto permanente
(não repetido manualmente em cada criação). Caso principal: **cristão**.

**5.1 Perfil cristão**

Identidade: mensagens cristãs profundas, humanas, reflexivas e
emocionalmente significativas.

Priorizar: fé, esperança, confiança em Deus, propósito, perseverança,
oração, graça, amor, arrependimento, restauração, consolo, sabedoria,
dependência de Deus, aplicação prática, reflexão espiritual.

Características: profundo, natural, acolhedor, humano, emocional,
reflexivo, esperançoso, não artificial.

Evitar: frases genéricas de autoajuda, clichês repetitivos, linguagem
artificial, sensacionalismo, manipulação emocional, promessas espirituais
absolutas, afirmações bíblicas inventadas, versículos falsamente
atribuídos, repetição excessiva de estruturas.

Importante: o sistema não deve simplesmente inserir "Deus" numa frase
motivacional — o conteúdo precisa ter coerência com o contexto cristão.

### 6. Separação entre nicho e objetivo

Nicho não é objetivo. Ex.: Nicho=Cristão + Objetivo=Engajamento +
Tema="Quando Deus parece estar em silêncio"; ou Nicho=Cristão +
Objetivo=Vendas + Produto="Livro devocional". Essa separação permite
reutilização da arquitetura.

### 7. Modelo semântico

Camada interna representando a intenção (não exposta obrigatoriamente ao
usuário):

```
SemanticModel: intent, objective, audience, subject, theme, coreTruth,
problem, desire, benefits, emotion, tone, format, platform, duration,
ctaObjective, product, context, references, constraints
```

Exemplo:
```json
{
  "intent": "message",
  "objective": "reflection",
  "audience": "people experiencing uncertainty",
  "theme": "waiting on God",
  "coreTruth": "waiting does not necessarily mean abandonment",
  "emotion": "pain_to_hope",
  "tone": "deep_and_warm",
  "format": "short_video",
  "duration": 30,
  "ctaObjective": "share"
}
```

### 8. Creative Strategy

Antes de escrever, a IA decide a estratégia:

```
CreativeStrategy: hookStrategy, developmentStrategy, emotionalArc,
benefitStrategy, ctaStrategy, tone, pacing, visualStrategy
```

Ex.: Hook = identificação+curiosidade; Development = apresentar o
problema e reinterpretá-lo; Emotional arc = dor→reflexão→esperança; CTA =
compartilhamento. Dinâmica, não fixa.

### 9. Gancho

Orientado por objetivo, não por fórmula. Objetivo: interromper o scroll,
criar curiosidade, gerar identificação, introduzir tensão, criar pergunta
mental, provocar emoção.

Estratégias possíveis: curiosidade, pergunta, identificação, contraste,
surpresa, descoberta, observação, confissão, dor, promessa de reflexão,
afirmação inesperada.

Não obrigar "Se você...", não obrigar "Não passe...", não obrigar
qualquer estrutura fixa — a IA decide.

**9.1 Regra de geração**: instruir "Escolha a melhor estratégia de
abertura para este contexto e escreva naturalmente", nunca "Preencha esta
frase".

### 10. Desenvolvimento

Núcleo da mensagem. Deve responder: qual é a ideia? por que importa? o
que o espectador reconhece? qual reflexão deve acontecer? qual
transformação de perspectiva? qual aplicação?

Estrutura interna sugerida: Ideia → Identificação → Reflexão →
Reinterpretação → Aplicação. Nem todo texto precisa usar todas as etapas.

### 11. Exemplo de desenvolvimento cristão

Tema: Quando Deus parece estar em silêncio.

Gancho: "Nem todo silêncio de Deus significa ausência."

Desenvolvimento: "Às vezes, a gente ora esperando uma resposta imediata e
começa a acreditar que Deus se afastou. Mas existem momentos em que não
enxergamos o que Ele está fazendo, e ainda assim somos chamados a
continuar confiando. Talvez você esteja olhando para o silêncio como
abandono, quando esse período também pode estar ensinando você a confiar
sem precisar enxergar tudo."

CTA: "Se essa mensagem falou com você, compartilhe com alguém que também
está aprendendo a esperar em Deus."

(Estrutura é exemplo, não fórmula fixa.)

### 12. CTA

Orientado por objetivo. Tipos: ENGAGEMENT_LIKE, ENGAGEMENT_COMMENT,
ENGAGEMENT_SHARE, ENGAGEMENT_FOLLOW, ENGAGEMENT_SAVE, SALE, DISCOVERY,
LOW_PRESSURE. Nunca sempre igual.

### 13. Diversidade

Controlada, não aleatória. Futuro: `CreativeHistory` registrando
hookType, openingPattern, tone, emotionalArc, ctaPattern, structure,
visualPattern — evitar repetir excessivamente abertura/expressão/
estrutura/CTA/progressão emocional. Objetivo: variedade sem perder
identidade. **Não entra na primeira PR.**

### 14. Escrita universal

Primeiro perfil é cristão, mas a arquitetura não deve ser exclusiva a
isso — permitir PROFILE = fitness/educação/negócios/moda/tecnologia/
personal/custom. Nicho muda o contexto; a arquitetura não muda.

### 15. Referências

Sistema pode receber imagem, vídeo, texto, produto, personagem, roupa,
ambiente, documento, briefing. IA distingue: OBSERVADO, FORNECIDO,
INFERIDO, CRIATIVO. Nunca inventar elementos como fatos.

### 16. Locks

Independentes: IDENTITY LOCK, WARDROBE LOCK, PRODUCT LOCK, ENVIRONMENT
LOCK, CAMERA LOCK, VOICE LOCK (detalhes de cada um na seção original).

### 17. Claims

Não inventados. Classificações futuras: VERIFIED, USER_PROVIDED,
VISUAL_INFERENCE, CREATIVE, UNVERIFIED. Ex. proibido sem fonte: "Milhares
de pessoas já compraram." Ex. permitido: "Este livro pode ser uma
companhia para seus momentos de reflexão."

### 18. Timing

Validação técnica, não objetivo criativo. Não instruir "escreva
exatamente 110 caracteres" — usar TARGET_DURATION (ex.: 8-10s). Fluxo: IA
cria → código calcula → fora do limite? → revisão → recalcula →
aprovação. Contador de caracteres permanece como guardrail.

### 19. Quality Judge

Critérios: NATURALIDADE, ESPECIFICIDADE, HOOK_STRENGTH, COHERENCE,
EMOTIONAL_PROGRESS, DEPTH, CTA_NATURALNESS, REPETITION, CLAIM_SAFETY,
VISUAL_ALIGNMENT, CONTINUITY. O judge não substitui o gerador.

### 20. Separação de responsabilidades

GENERATOR cria. JUDGE avalia. REVISION corrige. COMPLIANCE bloqueia.
TIMING mede. FINALIZER monta o resultado.

### 21-22. Ferramenta de criação com ChatGPT + fluxo

ChatGPT atua como CREATIVE DIRECTOR (entende briefing, encontra ângulo,
cria conceito, escolhe estratégia, escreve, revisa, gera variações,
analisa qualidade, adapta, transforma em prompt). Template Creator atua
como CREATIVE PRODUCTION SYSTEM (estrutura, aplica perfil/locks, valida,
calcula timing, executa fallback, produz saída final).

### 23-24. Vídeo / Prompt final de vídeo

Cada bloco: ROLE, OBJECTIVE, VISUAL, ACTION, DIALOGUE, CAMERA, VOICE,
TIMING, CONTINUITY. Prompt final: REFERENCE LOCK, CHARACTER LOCK,
WARDROBE LOCK, PRODUCT LOCK, ENVIRONMENT LOCK, CAMERA LOCK, VOICE LOCK,
SCENE OBJECTIVE, VISUAL ACTION, DIALOGUE, TIMING, CONTINUITY, NEGATIVE
CONSTRAINTS, QUALITY REQUIREMENTS.

### 25. Negative constraints

Não alterar identidade/roupa/produto/embalagem/capa; não criar elementos
inexistentes; não adicionar texto/legenda/música não solicitados; não
alterar cenário/voz/sotaque sem instrução; não inventar claims/
testemunhos; não transformar personagem religioso em divindade em 1ª
pessoa.

### 26. Religioso / personagem

Definir papel explicitamente (ex.: "PERSONAGEM RELIGIOSO / REPRESENTAÇÃO")
— nunca assumir ROLE = DIVINDADE automaticamente. Bloquear frases como
"Eu sou Deus.", "Eu te abençoo.", "Eu prometo que Deus fará...", "Meu
filho...". Proteção semântica e lexical.

### 27. Compatibilidade com o sistema atual

Sistema atual de Blocos de Venda não deve ser destruído — evolução
incremental. Manter: Zod, validação estrutural, banned phrases, divine
compliance, timing, judge, revisão, fallback, variantes
curto/padrão/longo.

### 28-32. PRs 1-5

1. **Gancho** — substituir molde fixo por objetivo+estratégia. Manter
   timing/claims/compliance/judge/fallback/validações. Não alterar
   revelação/dor/alívio/CTA/SemanticModel completo/Claim States/locks
   globais/diversidade/UI ampla. ✅ feito (PR #67).
2. **Revelação** — mesmo princípio.
3. **Dor/Identificação** — substituir fórmula fixa por intenção
   narrativa.
4. **Alívio/Benefício** — gerar resolução emocional conforme contexto.
5. **CTA** — permitir estratégias (curtir/comentar/compartilhar/
   seguir/salvar/venda).

### 33. Fase 2

Depois dos blocos funcionando: SemanticModel, CreativeStrategy, Locks,
Claim States, Full Script Judge, CreativeHistory, diversidade
controlada, Universal Writing Engine.

### 34. Não fazer uma PR gigante

Motivos: risco de regressão, dificuldade de revisão, rollback complexo,
dificuldade de identificar causa de bugs, impacto em produção, testes
mais difíceis. Cada PR: pequena, testável, escopo único, preserva
fallback, reversível.

### 35. Testes

Gancho: não deve exigir "Se você"; deve gerar linguagem natural; deve
respeitar timing; não deve gerar claim proibida; deve passar pelo judge;
fallback deve funcionar. Mensagem: estrutura coerente, profundidade, CTA
adequado. Vendas: produto presente, claims verificáveis, CTA comercial.
Vídeo: continuidade, timing, locks.

### 36. Métricas futuras

Retenção, conclusão, compartilhamento, comentários, curtidas, seguidores
gerados, CTR, conversão — podem futuramente alimentar aprendizado de
estratégia. Nunca substituir regras de segurança.

### 37. Princípio de adaptação

Sistema adapta a estrutura à intenção, não a intenção à estrutura.

### 38. Princípio de naturalidade

IA não escreve para satisfazer um contador — escreve para uma pessoa.
Código verifica depois: duração, estrutura, segurança, compliance,
qualidade.

### 39. Princípio de profundidade cristã

Não usar só palavras religiosas — construir pensamento. Mensagem
profunda: combinação relevante de conflito humano, verdade espiritual,
reflexão, mudança de perspectiva, aplicação, esperança. Evitar frase
genérica solta tipo "Deus está com você, não desista." sem desenvolver.

### 40. Princípio de retenção

Progressão: Gancho → pergunta implícita → desenvolvimento → descoberta →
consequência → fechamento. Espectador precisa de motivo pra continuar.

### 41. Princípio de compartilhamento

Mensagens compartilháveis geralmente têm: identificação, consolo,
descoberta, verdade, utilidade emocional, frase memorável, aplicação.

### 42. Interface futura

Tela principal "O que você quer criar?" com botões
[MENSAGEM][ENGAJAMENTO][VENDAS][ROTEIRO][PERSONALIZADO], depois
tema/briefing, objetivo, tom, duração, referências, gerar.

### 43. Preset cristão

PERFIL = KRONIA CRISTÃO carrega automaticamente vocabulário, tom,
princípios, temas, estrutura, cuidados, estilo, objetivos possíveis.

### 44. Futuro — biblical knowledge

Base de conhecimento bíblico confiável pra referências/contexto/
versículos/personagens/conceitos/temas. IA não inventa citações — toda
referência bíblica precisa de fonte/validação.

### 45. Futuro — learning loop

Resultado → Métricas → Análise → Padrões → Insights → Melhoria de
estratégia. Nunca transformar automaticamente um resultado em regra
universal.

### 46. Resultado final esperado

Criar mensagens, roteiros, legendas, anúncios, vídeos, textos, CTAs,
reflexões, conteúdo cristão, conteúdo comercial, conteúdo personalizado —
sem virar um novo template rígido a cada novo caso.

### 47. Arquitetura final

```
                    KRONIA CREATOR
                           │
                           ▼
                  CREATIVE BRAIN
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           INTENT       CONTEXT      REFERENCES
              │            │            │
              └────────────┼────────────┘
                           ▼
                    SEMANTIC MODEL
                           │
                           ▼
                  CREATIVE STRATEGY
                           │
                           ▼
                      GENERATOR
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          WRITING        VISUAL         VIDEO
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                       VALIDATOR
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          TIMING        CLAIMS        COMPLIANCE
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                         JUDGE
                           │
                           ▼
                       REVISION
                           │
                           ▼
                       FINALIZER
                           │
                           ▼
                       OUTPUT
```

### 48. Regra de ouro

O Template Creator não deve tentar ser criativo através de centenas de
frases prontas — deve criar um ambiente no qual a IA consiga ser criativa
dentro de limites confiáveis.

Código controla: contrato, segurança, consistência, tempo, validação,
fallback. IA controla: ideia, estratégia, linguagem, emoção, narrativa,
variação.

### 49. Conclusão

Duas dimensões: **Dimensão 1 (agora)** — melhorar o motor atual sem
quebrá-lo, começando pelo Gancho, depois Revelação/Dor/Alívio/CTA, sempre
uma PR por vez. **Dimensão 2 (futuro)** — extrair as capacidades comuns
pra um Universal Writing Engine, com o perfil cristão como especialização
dentro desse motor. Objetivo final: não "gerador de blocos de venda", mas
"motor de direção criativa capaz de compreender uma intenção e produzir
conteúdo adequado ao objetivo, nicho, formato e contexto."
