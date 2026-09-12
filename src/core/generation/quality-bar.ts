/**
 * Barra de qualidade criativa compartilhada — reaproveitada pelos
 * sub-agentes de Geração (marketing/persuasao/psicologia-compra) que
 * revisam texto, não pelo Roteirista (que já tem sua própria disciplina
 * de craft em roteirista.ts) nem pelo Cinematográfico (que trabalha
 * direção visual, não copy). Não é um agente novo — é um bloco de regra
 * reaproveitado no SYSTEM prompt de quem já existe, pra não duplicar o
 * mesmo texto em 3 arquivos.
 */
export const CREATIVE_QUALITY_BAR = `REGRA DE QUALIDADE — nunca deixe passar clichê/genérico:
Banido, a menos que seja literalmente a única opção honesta pro produto: "você já parou pra
pensar", "descubra", "transforme sua vida/rotina", "não é apenas um", "mais do que um simples",
"chegou a hora de", metáfora batida ("um mundo de possibilidades"), CTA genérico solto
("garanta o seu", "não perca", "confira agora") sem nenhuma conexão com a cena anterior.

Teste de especificidade antes de aceitar uma frase: "essa frase funcionaria pra 100 produtos
diferentes, só trocando o nome?" Se sim, ela não está pronta — falta algo do produto/contexto
REAL (não inventado) que só faz sentido aqui.

Teste de naturalidade: leria essa frase em voz alta pra um amigo sem soar como propaganda de
IA? Se soar corporativo, robótico ou "produzido demais", reescreva mais direto/humano.`;
