import type { TargetProfile } from "./schemas";

/**
 * Registry estático de Target Profiles — Fase 1 cobre só Veo/Flow/Kling
 * (Seedance/Sora/Runway ficam pro futuro, registry é extensível por
 * design). Toda capability não confirmada por fonte pública verificável
 * fica "unknown" — nunca "supported" por suposição (item 17 do adendo
 * final: "nenhuma capability declarada como supported sem fonte
 * verificável").
 *
 * Flow != Veo: confirmado via busca real (blog.google, "Introducing Flow:
 * Google's AI filmmaking tool designed for Veo", set/2026) — Flow é uma
 * PLATAFORMA construída sobre Veo 3.1 + Imagen 4 + Gemini, com camadas
 * próprias (SceneBuilder: timeline multi-clipe; extensão de vídeo;
 * upscaling 2K/4K) que um prompt direto pro Veo não tem. Por isso Flow
 * tem kind:"platform" e basedOn:["veo"], herdando as capabilities do Veo
 * e declarando as suas próprias por cima — nunca tratado como um segundo
 * "model" equivalente.
 */
export const TARGET_PROFILES: TargetProfile[] = [
  {
    id: "veo",
    kind: "model",
    name: "Veo",
    basedOn: null,
    capabilities: {
      text_to_video: "supported",
      image_to_video: "supported",
      multi_shot: "unknown",
      character_reference: "unknown",
      audio_native: "unknown",
    },
    requiredCapabilities: null,
    specialistImplementation: "deterministic",
    source: "Documentação pública do Google sobre Veo/Flow (blog.google, set/2026)",
    lastVerified: "2026-09-12",
    status: "active",
  },
  {
    id: "flow",
    kind: "platform",
    name: "Flow",
    basedOn: ["veo"],
    capabilities: {
      text_to_video: "supported",
      image_to_video: "supported",
      scene_builder_timeline: "supported",
      video_extension: "supported",
      upscaling: "supported",
      multi_shot: "supported",
    },
    requiredCapabilities: null,
    specialistImplementation: "deterministic",
    source:
      "blog.google — \"Introducing Flow: Google's AI filmmaking tool designed for Veo\" (confirma SceneBuilder/extensão/upscaling sobre Veo 3.1+Imagen 4+Gemini)",
    lastVerified: "2026-09-12",
    status: "active",
  },
  {
    id: "kling",
    kind: "model",
    name: "Kling",
    basedOn: null,
    capabilities: {
      text_to_video: "supported",
      image_to_video: "supported",
      motion_control: "unknown",
      multi_shot_storyboard: "unknown",
      avatar: "unknown",
    },
    requiredCapabilities: null,
    specialistImplementation: "deterministic",
    source:
      "Formato de referência auditado em repositório MIT (maciejdzierzek/kling-ai-prompt-generator) — capacidades específicas por variante não re-verificadas diretamente na documentação oficial da Kling nesta rodada, por isso marcadas \"unknown\" além do básico T2V/I2V",
    lastVerified: "2026-09-12",
    status: "active",
  },
];

/** Fallback fixo da Fase 1 — NUNCA chamado de "automático inteligente".
 * Ver TargetSelectionModeSchema em schemas.ts. */
export const DEFAULT_TARGET_ID = "veo";

export function getTargetProfile(id: string): TargetProfile | null {
  return TARGET_PROFILES.find((t) => t.id === id) ?? null;
}
