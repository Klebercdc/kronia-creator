# KRONIA Creator — Como o motor deve pensar ao receber uma imagem

Especificação (v1.0) do comportamento criativo esperado da IA de geração,
definida pelo usuário. Complementa `docs/creative-engine-vision.md`
(seção 9 — Gancho) detalhando a camada de raciocínio que vale pra toda a
cadeia imagem→roteiro, não só o bloco Gancho.

## Status de implementação

Ainda não incorporado no código. `blocos-venda-vision.ts` (PR #67) já
aplica o princípio central pro campo `gancho` especificamente
("objetivo, não fórmula" — ver `GANCHO_FORMULA_ANTIGA` em
`blocos-venda-fala.ts`), mas não implementa as "camadas de pergunta"
(seção 23) nem os testes de validação (seção 29) descritos aqui pra toda
a geração. Avaliar incorporar ao ajustar o `SYSTEM_BASE` nas próximas
PRs (Revelação/Dor/Alívio/CTA), depois de validar o resultado real do
Gancho em uso.

## Objetivo desta especificação (seção 1-2)

Não é ensinar a IA a escrever uma frase específica — é ensinar a decidir
"o que devo criar a partir desta imagem?". A imagem é referência, não
determina sozinha o roteiro: o motor combina IMAGEM + PERFIL DO USUÁRIO +
NICHO + OBJETIVO + FORMATO + CONTEXTO + INTENÇÃO.

Regra central: a IA não pensa "qual template eu encaixo nesta imagem?",
pensa "qual conteúdo faz mais sentido pra esta imagem, este perfil, este
objetivo e este público? Como transformo essa ideia numa peça que faça a
pessoa parar, continuar e realizar a ação desejada?".

## Imagem de teste usada nesta spec (seção 3)

Personagem religioso semelhante a Jesus, sentado ao pôr do sol, olhando
direto pra câmera, Bíblia nas mãos, uma mão estendida em direção ao
espectador. Elementos observáveis: personagem religioso, Bíblia,
expressão serena, contato visual, gesto de aproximação, ambiente natural,
pôr do sol, atmosfera contemplativa, sensação de acolhimento, composição
cinematográfica, formato vertical. O sistema não deve inventar
informação que não está presente.

## As 10 perguntas internas (seções 4-13)

1. **Quem sou eu neste contexto?** — o perfil do projeto (ex.: cristão)
   muda a interpretação da imagem: "homem sentado segurando um livro"
   vira "personagem religioso em cena contemplativa adequada a mensagem
   cristã".
2. **O que o usuário quer criar?** — Mensagem / Engajamento / Vendas /
   Roteiro / Personalizado / IA decide. Se já escolhido, não redescobrir.
3. **Qual é o objetivo real?** — retenção, reflexão, compartilhamento,
   comentários, curtidas, seguidores, vendas, inspiração, consolo,
   ensino. Influencia a estratégia.
4. **O que a imagem comunica naturalmente?** — no exemplo: proximidade,
   acolhimento, serenidade, reflexão, espiritualidade, convite à
   atenção, confiança. Aproveitar essas características, nunca
   contradizer a imagem.
5. **Qual assunto combina naturalmente com o que estou vendo?** — ex.:
   esperar em Deus, confiar sem entender, silêncio, esperança, oração,
   propósito, perseverança, paz, fé em momentos difíceis. Escolher o
   tema mais coerente com imagem+perfil+objetivo — não precisa ser
   sempre o mesmo.
6. **Qual é a verdade ou ideia central?** — ex. tema "esperar em Deus" →
   verdade central "o silêncio ou a espera não significam
   necessariamente abandono". Impede o texto de virar só frases bonitas
   soltas.
7. **Qual emoção quero produzir?** — identificação, consolo, esperança,
   reflexão, paz, encorajamento, arrependimento, gratidão. Escolher uma
   progressão (ex.: dor → reflexão → esperança).
8. **Por que alguém continuaria assistindo?** — fundamental. Não basta
   gancho+frases bonitas+CTA — precisa criar uma razão real pra
   continuar, uma progressão de perguntas implícitas (gancho cria
   pergunta → desenvolvimento explica conflito → nova pergunta implícita
   → reflexão muda perspectiva → fechamento entrega sentido).
9. **Qual deve ser o próximo pensamento do espectador?** — o roteiro
   funciona como sequência de pensamentos (ex.: "isso parece falar
   comigo" → "eu realmente estou cansado de esperar" → "talvez eu esteja
   interpretando errado" → "preciso continuar confiando" → "preciso
   compartilhar isso"). Mecanismo principal de retenção.
10. **Como o visual e a fala trabalham juntos?** — ex.: personagem olha
    pra câmera → fala fala diretamente com o espectador; mão estendida →
    sensação de acolhimento/convite; Bíblia → pode abordar fé/Palavra/
    oração quando coerente; pôr do sol → reforça atmosfera contemplativa.
    Não é obrigatório citar literalmente cada elemento.

## Não descrever a imagem desnecessariamente (seção 14)

Evitar "Jesus está sentado ao pôr do sol segurando uma Bíblia..." quando
isso não contribui pra mensagem — o visual já mostra isso. Regra: **o
visual mostra, a fala significa.**

## Como escolher gancho / desenvolvimento / final (seções 15-18)

Gancho: definir objetivo (fazer a pessoa parar) antes da estratégia
(identificação, curiosidade, pergunta, contraste, surpresa, afirmação
inesperada, dor, descoberta, observação, confissão, promessa de
reflexão) — não existe resposta única.

Desenvolvimento responde ao tipo de gancho: se cria tensão, resolve
gradualmente; se cria pergunta, responde progressivamente; se cria
identificação, aprofunda; se cria contraste, explica o novo ponto de
vista.

Final fecha a ideia, depois escolhe o CTA conforme o objetivo (nunca
forçado — reflexão pode ter CTA discreto, engajamento explícito, venda
orientada à oferta. CTA é consequência do objetivo, não obrigação fixa).

## Profundidade e proteções (seções 19-22)

Evitar que "Deus está com você"/"Não desista"/"Tenha fé" sejam a
estrutura inteira — podem aparecer quando fazem sentido, mas o motor
deve buscar: conflito humano + verdade espiritual + reflexão + mudança
de perspectiva + aplicação + esperança.

Não inventar teologia: reflexão pode ser criada, mas versículo/citação/
capítulo/personagem bíblico/afirmação doutrinária específica precisa de
fonte ou validação.

Não usar sensacionalismo ("Deus mandou este vídeo pra você", "Deus
revelou que sua vida vai mudar hoje" etc.).

Personagem visual (pode representar Jesus) não é automaticamente
autoridade divina em 1ª pessoa — evitar "Eu sou Deus"/"Eu te
abençoo"/"Eu prometo que Deus fará isso" sem razão e tratamento
apropriado (mesmo princípio já implementado via `DIVINE_RE` em
`BlocosVendaGenerator.tsx`).

## As 8 camadas (seção 23)

1. O que tenho? (imagem + briefing + perfil + objetivo)
2. O que isso significa? (tema + contexto + emoção)
3. O que quero produzir? (atenção + retenção + reflexão + ação)
4. Como fazer? (estratégia narrativa)
5. Como escrever? (linguagem natural)
6. Como produzir? (cenas + câmera + voz + ações)
7. Está bom? (judge)
8. Está dentro das regras? (compliance + timing)

## Exemplo de decisão completa pra imagem de teste (seções 24-26)

Perfil cristão + tipo mensagem + objetivo retenção/compartilhamento →
tema "esperar em Deus", ângulo "o silêncio não significa abandono",
emoção cansaço→reflexão→esperança, gancho por identificação+curiosidade,
desenvolvimento problema→interpretação→mudança de perspectiva, CTA de
compartilhamento. Exemplo de saída ilustrativo (a IA não deve ser
instruída a reproduzir esse texto literal — só entender o processo):

> **Gancho**: "Talvez você esteja cansado de esperar… mas antes de
> desistir, precisa ouvir isso."
> **Desenvolvimento**: "Existem momentos em que você ora, pede uma
> resposta e parece que nada acontece. Mas o silêncio de Deus não
> significa que Ele deixou de cuidar de você..."
> **Reflexão**: "Talvez esse tempo não esteja sendo um atraso… talvez
> esteja ensinando você a confiar mesmo sem enxergar o caminho inteiro."
> **CTA**: "Se essa mensagem falou com você, compartilhe com alguém que
> também precisa continuar confiando em Deus."

Princípio de não repetição: se já usou "Talvez você...", considerar
outras aberturas na próxima geração (ex.: "Nenhum silêncio é vazio
quando Deus está trabalhando.", "Existe uma diferença entre Deus estar em
silêncio e Deus estar ausente."). A diversidade preserva a mensagem
central.

## Divisão de responsabilidades (seções 27-28)

**Código deve**: fornecer contexto/perfil/objetivo/referências, validar
estrutura/timing/claims/compliance, executar judge, solicitar revisão,
executar fallback.

**Código NÃO deve**: escrever a frase, impor abertura, impor fórmula,
determinar exatamente quais palavras usar, obrigar estrutura linguística
fixa.

**IA deve**: interpretar, criar, escolher, desenvolver, conectar, variar,
revisar, adaptar — pensar como **diretor criativo**, não como
**preenchedor de campos**.

## Teste de validação e critério de sucesso (seções 29-31)

Com perfil cristão + tipo mensagem + objetivo retenção/compartilhamento +
tema "esperar em Deus", gerar múltiplas vezes e verificar: ganchos
variam? soam naturais? continuam ligados ao tema? não parecem fórmula? a
imagem influencia a estratégia? desenvolvimento tem progressão? CTA
corresponde ao objetivo? timing válido? regras religiosas protegidas?
fallback funciona?

Critério de sucesso: não basta "gerou uma frase correta" — precisa
"gerou uma ideia adequada" (o sistema recebeu uma imagem e produziu algo
que parece ter sido pensado pra aquela imagem, aquele nicho e aquele
objetivo).

## Princípio final (seção 31)

O sistema não pergunta "qual frase devo colocar neste bloco?". Pergunta,
em ordem: "qual experiência quero criar pra quem assistir?" → "qual
ideia fará essa pessoa continuar?" → "qual emoção quero deixar?" → "qual
ação faz sentido?" → só então "como devo escrever?".

A imagem não é molde, é contexto. O objetivo não é uma frase, é a
experiência que a criação deve produzir.
