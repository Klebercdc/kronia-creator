# KRONIA Creator — Creative Engine Reverse Thinking

## Objetivo

Documentar o processo decisório que o motor precisa reproduzir de forma observável, sem depender de uma cadeia de frases fixas.

A especificação não transforma raciocínio interno do modelo em texto de usuário nem exige explicação de cadeia de pensamento. Ela transforma o comportamento desejado em um contrato operacional: entradas, decisões, evidências, estratégias, validações e saída.

## Princípio central

O motor deve decidir antes de escrever.

Fluxo:

REFERÊNCIA
→ EVIDÊNCIAS OBSERVÁVEIS
→ CONTEXTO ISOLADO
→ INTENÇÃO
→ OBJETIVO
→ TEMA/PROBLEMA
→ VERDADE CENTRAL
→ EMOÇÃO
→ ESTRATÉGIA CRIATIVA
→ ESCRITA
→ VALIDAÇÃO
→ JUDGE
→ REVISÃO
→ SAÍDA

A IA decide como comunicar.
O código decide o que é válido.

## 1. Passo de evidência

Pergunta operacional:

"O que eu realmente sei?"

Separar:

- fatos fornecidos pelo usuário;
- elementos visualmente observáveis;
- informações verificadas;
- inferências permitidas;
- ideias criativas.

Nunca transformar inferência em fato.
Nunca preencher ausência de informação com invenção factual.

## 2. Passo de contexto

Pergunta operacional:

"Em qual contexto estou criando?"

Contexto mínimo:

- projeto/perfil;
- nicho;
- tipo de conteúdo;
- objetivo;
- plataforma/formato;
- duração;
- referência atual;
- briefing atual.

Informações de outra criação não entram no contexto atual sem serem explicitamente fornecidas.

## 3. Passo de intenção

Pergunta operacional:

"O que o usuário realmente quer produzir?"

Intenções iniciais:

- message;
- engagement;
- sales;
- script;
- custom.

Não escolher a intenção pela aparência da imagem quando o usuário já a definiu explicitamente.

## 4. Passo de objetivo

Pergunta operacional:

"Qual comportamento ou experiência quero provocar?"

Exemplos:

- retenção;
- reflexão;
- compartilhamento;
- comentário;
- seguir;
- salvar;
- conversão;
- ensino;
- acolhimento.

O objetivo muda a estratégia.

## 5. Passo de leitura da referência

Pergunta operacional:

"O que a referência me permite fazer?"

Para imagem:

- personagem;
- expressão;
- gesto;
- objeto;
- produto;
- cenário;
- luz;
- composição;
- relação espacial;
- ação já iniciada.

Não descrever tudo apenas porque existe.
Selecionar o que pode contribuir para a criação.

## 6. Passo de oportunidade criativa

Pergunta operacional:

"Qual elemento desta referência tem maior potencial narrativo?"

Exemplo:

Uma mão estendida para a câmera pode funcionar como sinal de proximidade.

Uma Bíblia pode sustentar contexto cristão.

Um produto visualmente marcante pode sustentar reveal ou demonstração.

O objetivo é encontrar o elemento narrativamente útil, não recitar a foto.

## 7. Passo de tema

Pergunta operacional:

"Qual assunto combina melhor com contexto + referência + objetivo?"

A IA pode escolher entre múltiplos temas plausíveis.

Não deve ficar presa ao primeiro tema encontrado.

## 8. Passo de verdade central

Pergunta operacional:

"Qual é a ideia que o espectador deve levar consigo?"

Exemplo cristão:

Tema: esperar em Deus.

Verdade central: não compreender o que está acontecendo não significa abandono.

Essa camada impede que a mensagem seja apenas uma coleção de frases bonitas.

## 9. Passo emocional

Pergunta operacional:

"De onde a pessoa parte emocionalmente e onde quero deixá-la?"

Exemplo:

cansaço → identificação → reflexão → esperança.

A progressão emocional deve ter começo, desenvolvimento e fechamento.

## 10. Passo de retenção

Pergunta operacional:

"Por que a pessoa continuaria assistindo depois do primeiro bloco?"

O gancho deve criar uma razão para continuar.

O desenvolvimento precisa preservar uma pergunta, tensão, descoberta ou progressão.

Não entregar o payoff cedo demais.

## 11. Passo de estratégia

Pergunta operacional:

"Qual mecânica é melhor para este caso?"

Possibilidades:

- curiosidade;
- identificação;
- pergunta;
- contraste;
- descoberta;
- demonstração;
- história;
- emoção;
- resultado;
- objeção;
- chamada de identidade;
- pattern interrupt.

A biblioteca de hooks fornece repertório.
Ela não fornece frases para copiar.

## 12. Passo de escrita

Somente agora a IA escreve.

A regra é:

"Resolva o problema criativo com linguagem natural."

Não:

"Preencha uma frase pré-definida."

Evitar fórmulas universais como:

- "Se você é...";
- "Isso não é só...";
- "Na correria da vida...";
- "Se essa mensagem fez sentido...".

Essas construções podem aparecer em alguma criação quando fizerem sentido, mas nunca devem ser obrigatórias por arquitetura.

## 13. Regra visual + verbal

O visual mostra.
A fala acrescenta significado.

A fala não deve repetir literalmente o que já está evidente, a menos que exista função narrativa ou comercial clara.

Exemplo:

Visual: conjunto rosa já visível.

Fraco:

"Este é um conjunto rosa de top e shorts."

Mais útil:

usar a fala para destacar um detalhe visível, uma situação de uso ou uma decisão de compra permitida pelos dados.

## 14. Regra de intenção para CTA

CTA é consequência da intenção + objetivo.

Exemplos:

message + share → compartilhar.

engagement + comment → comentar.

engagement + follow → seguir.

sales + conversion → conferir/clicar/comprar.

Não reutilizar um CTA de mensagem em uma venda.

## 15. Regra de produto

O produto deve possuir uma fonte de verdade.

Fonte prioritária:

1. informação explicitamente fornecida;
2. informação visualmente observável;
3. dado verificado.

Se não existir fonte suficiente, não afirmar.

## 16. Regra de claims

Toda afirmação factual precisa ter estado de evidência claro.

Estados conceituais:

VERIFIED
USER_PROVIDED
OBSERVED
INFERRED
CREATIVE
UNVERIFIED

UNVERIFIED não deve virar claim factual final.

## 17. Regra de consistência

Quando a referência define identidade, produto, roupa, ambiente ou voz, essas informações devem ser tratadas como locks quando aplicável.

Criatividade muda a narrativa.

Não muda o objeto de referência sem autorização.

## 18. Regra de timing

Timing é uma restrição posterior à escrita.

Não escrever para satisfazer um contador.

Fluxo:

CRIAR
→ MEDIR
→ REVISAR
→ MEDIR NOVAMENTE

Fallback continua obrigatório.

## 19. Rule of minimal invention

Quando dois caminhos são possíveis, escolher a opção que exige menos fatos não fornecidos.

Exemplo:

Se a imagem mostra um livro, pode-se dizer "livro".

Não afirmar título, quantidade de páginas, benefícios ou resultados sem evidência.

## 20. Judge

O judge deve avaliar o resultado final, não apenas campos isolados.

Critérios mínimos:

- naturalidade;
- especificidade;
- coerência;
- força do gancho;
- progressão;
- aderência à intenção;
- CTA adequado;
- segurança factual;
- compatibilidade visual.

## 21. Revisão

A revisão deve receber instruções cirúrgicas.

Exemplo:

"CTA incompatível com intent=sales; reescreva somente o CTA como próximo passo comercial, mantendo o produto e o contexto atuais."

Não reescrever todo o roteiro para corrigir um único problema.

## 22. Fallback

Fallback não é estratégia criativa principal.

É rede de segurança.

Quando a IA falhar repetidamente em:

- schema;
- timing;
- compliance;
- gramática crítica;
- coerência mínima;

usar saída determinística segura.

## 23. Caso cristão — imagem sem produto

Entrada:

perfil = cristão
intent = message
objective = retenção + compartilhamento
referência = personagem religioso + Bíblia + gesto de acolhimento + pôr do sol.

Decisão provável:

tema = espera/confiança/fé

A estratégia pode ser:

identificação + curiosidade

ou:

afirmação inesperada + reflexão.

O motor deve escolher uma, não copiar uma frase fixa.

## 24. Caso comercial — conjunto rosa

Entrada:

intent = sales
objective = conversion
referência = conjunto rosa real.

Evidências visuais:

- top;
- shorts;
- cor rosa;
- botões;
- alças;
- cós elástico;
- bolsos visíveis.

Estratégia provável:

hook baseado em detalhe visual ou situação de uso
→ apresentação/reveal
→ benefício permitido
→ CTA comercial.

O sistema não deve inserir:

"Se essa mensagem fez sentido para você..."

porque essa linguagem pertence a outro intent.

## 25. Teste de separação de contexto

Executar sequencialmente:

CASE A:
conteúdo cristão.

CASE B:
venda de roupa.

Depois do CASE B, repetir CASE A.

Esperado:

nenhuma informação do CASE B contaminando CASE A.

Repetir CASE B depois.

Esperado:

nenhuma linguagem de CASE A contaminando CASE B.

## 26. O que é "engenharia reversa" neste projeto

Não tentar reproduzir pensamentos privados ou exigir uma cadeia de pensamento exposta.

Reproduzir o comportamento observável por meio de decisões estruturadas:

OBSERVAÇÃO
→ INTERPRETAÇÃO CONTROLADA
→ DECISÃO
→ AÇÃO
→ VERIFICAÇÃO.

Isso transforma o padrão desejado do criador em um sistema auditável.

## 27. Contrato operacional

A IA recebe:

- problema criativo;
- contexto;
- evidências;
- objetivo;
- restrições.

A IA entrega:

- estratégia;
- texto;
- direção criativa.

O código verifica:

- schema;
- timing;
- claims;
- compliance;
- consistência;
- compatibilidade de intenção;
- fallback.

## 28. Regra final

O motor nunca deve começar com:

"Qual fórmula devo preencher?"

Deve começar com:

"O que esta criação precisa fazer?"

Depois:

"O que a referência me dá para fazer isso?"

Depois:

"Qual estratégia é mais adequada?"

Depois:

"Como eu escreveria isso de forma natural?"

Só então:

"O resultado passou pelos contratos?"

## 29. Critério de sucesso

Uma criação está correta quando parece ter sido pensada especificamente para:

- aquela referência;
- aquele contexto;
- aquele nicho;
- aquele objetivo;
- aquele formato.

Não apenas quando a gramática está correta.

Não apenas quando o texto cabe no tempo.

O objetivo do KRONIA Creator é produzir decisões criativas contextualizadas com segurança operacional.
