import { z } from "zod";
import { callStructured } from "../../lib/llm";
import type { ActorProfile, FlowSegment, ScriptScene } from "../../types/pipeline";

const RefinedPromptSchema = z.object({ videoPrompt: z.string() });

const SYSTEM = `Você é o agente Cinematográfico do KRONIA, no modo de AJUSTE PONTUAL: o usuário já
tentou gerar esse bloco de 10s específico no Google Flow (Veo) e não ficou como queria — boca não
sincronizou, uma palavra não saiu bem, o movimento não é o que ele pediu, etc. Reescreva SÓ o
"videoPrompt" desse segmento, incorporando o feedback do usuário.

Mantenha o vocabulário cinematográfico técnico real (movimento de câmera nomeado, lente,
iluminação, 9:16, ação física específica) e a MESMA sequência de ação/narração do segmento, a não
ser que o feedback peça pra mudar isso especificamente. Se o segmento cobre mais de uma cena
narrativa, mantenha a estrutura de transições entre elas. Se o feedback disser que a boca não
mexe ou o áudio não sincronizou, ajuste o prompt pra enfatizar fala natural e sincronizada, ou
simplifique a ação pra dar menos trabalho de sincronização pro modelo de vídeo.

Nunca inclua texto na tela dentro do videoPrompt. Retorne só o "videoPrompt" novo, um parágrafo
único em prosa cinematográfica fluida.`;

/**
 * Ajusta o videoPrompt de UM segmento de 10s (o que realmente é submetido no
 * Flow) a partir de feedback do usuário — sem rodar o pipeline inteiro de
 * novo, mais rápido e sem repetir os agentes de copywriting que já ficaram bons.
 */
export async function refineScenePrompt(params: {
  segment: FlowSegment;
  scenes: ScriptScene[];
  actorProfile: ActorProfile | null;
  feedback: string;
}): Promise<string> {
  const { segment, scenes, actorProfile, feedback } = params;

  const coveredScenes = scenes.filter((s) => segment.sceneIndexes.includes(s.index));
  const scenesBlock = coveredScenes
    .map((s) => `- [${s.role}] Ação: ${s.action}. Narração: ${s.narration}`)
    .join("\n");

  const actorBlock = actorProfile
    ? `\nAtor principal fixo — "${actorProfile.name}": mantenha literalmente esta voz e aparência,
sem variar: Voz: ${actorProfile.voiceDescription} Aparência: ${actorProfile.appearanceDescription}`
    : "";

  const prompt = `Segmento atual (${segment.startSeconds}s–${segment.endSeconds}s):
Cenas cobertas por este bloco de 10s:
${scenesBlock}
videoPrompt atual: ${segment.videoPrompt}
${actorBlock}

Feedback do usuário sobre o que não ficou bom no Flow:
"${feedback}"

Reescreva o videoPrompt incorporando esse feedback.`;

  const result = await callStructured({
    schema: RefinedPromptSchema,
    system: SYSTEM,
    prompt,
    toolName: "refined_video_prompt",
  });

  return result.videoPrompt;
}
