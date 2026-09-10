import { z } from "zod";
import { callStructured } from "../../lib/llm";
import type { ActorProfile, ScriptScene } from "../../types/pipeline";

const RefinedPromptSchema = z.object({ videoPrompt: z.string() });

const SYSTEM = `Você é o agente Cinematográfico do KRONIA, no modo de AJUSTE PONTUAL: o usuário já
tentou gerar essa cena específica no Google Flow (Veo) e não ficou como queria — boca não
sincronizou, uma palavra não saiu bem, o movimento não é o que ele pediu, etc. Reescreva SÓ o
"videoPrompt" dessa cena, incorporando o feedback do usuário.

Mantenha o vocabulário cinematográfico técnico real (movimento de câmera nomeado, lente,
iluminação, 9:16, ação física específica) e a MESMA ação/narração da cena, a não ser que o
feedback peça pra mudar isso especificamente. Se o feedback disser que a boca não mexe ou o
áudio não sincronizou, ajuste o prompt pra enfatizar fala natural e sincronizada, ou simplifique
a ação da cena pra dar menos trabalho de sincronização pro modelo de vídeo.

Nunca inclua texto na tela dentro do videoPrompt. Retorne só o "videoPrompt" novo, um parágrafo
único em prosa cinematográfica fluida.`;

/**
 * Ajusta o videoPrompt de UMA cena a partir de feedback do usuário (ex: "a
 * boca não mexeu no Flow, tenta de novo sem enfatizar fala") sem rodar o
 * pipeline inteiro de novo — mais rápido e sem repetir a busca de hashtag
 * cara nem os agentes de copywriting que já ficaram bons.
 */
export async function refineScenePrompt(params: {
  scene: ScriptScene;
  actorProfile: ActorProfile | null;
  feedback: string;
}): Promise<string> {
  const { scene, actorProfile, feedback } = params;

  const actorBlock = actorProfile
    ? `\nAtor principal fixo — "${actorProfile.name}": mantenha literalmente esta voz e aparência,
sem variar: Voz: ${actorProfile.voiceDescription} Aparência: ${actorProfile.appearanceDescription}`
    : "";

  const prompt = `Cena atual:
Papel: ${scene.role}. Ação: ${scene.action}. Narração: ${scene.narration}.
videoPrompt atual: ${scene.videoPrompt}
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
