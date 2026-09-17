import { buildCharacterProfile, buildProductProfile, buildStylePatternProfile } from "./profiles";
import { deriveCandidateLocks } from "./locks";
import {
  ReferenceAssetSchema,
  ReferenceStudioInputSchema,
  type ReferenceAsset,
  type ReferenceStudioInput,
} from "../../types/reference-studio";
import type { VideoAnalysis } from "../../types/video-analysis";

export async function analyzeReferenceAsset(params: {
  input: ReferenceStudioInput;
  imageDataUrls?: string[];
  videoAnalysis?: VideoAnalysis | null;
  now?: string;
}): Promise<ReferenceAsset> {
  const input = ReferenceStudioInputSchema.parse(params.input);
  const now = params.now ?? new Date().toISOString();

  let profile: ReferenceAsset["profile"] = {
    character: null,
    product: null,
    style: null,
  };

  if (input.type === "person") {
    if (!params.imageDataUrls?.length) throw new Error("Uma imagem de personagem é obrigatória para análise.");
    profile.character = await buildCharacterProfile(params.imageDataUrls[0]);
  }

  if (input.type === "product") {
    if (!params.imageDataUrls?.length) throw new Error("Ao menos uma imagem de produto é obrigatória para análise.");
    profile.product = await buildProductProfile(params.imageDataUrls);
  }

  if (input.type === "video_style") {
    if (!params.videoAnalysis) throw new Error("A análise do vídeo de referência é obrigatória para criar um perfil de estilo.");
    profile.style = buildStylePatternProfile(params.videoAnalysis);
  }

  const evidence = [
    ...(profile.character?.identity ?? []),
    ...(profile.character?.body ?? []),
    ...(profile.character?.wardrobe ?? []),
    ...(profile.character?.voicePerformance ?? []),
    ...(profile.product?.visualAttributes ?? []),
    ...(profile.product?.claims ?? []),
    ...(profile.style?.hook ?? []),
    ...(profile.style?.structure ?? []),
    ...(profile.style?.pacing ?? []),
    ...(profile.style?.framing ?? []),
    ...(profile.style?.camera ?? []),
    ...(profile.style?.lighting ?? []),
    ...(profile.style?.composition ?? []),
    ...(profile.style?.performance ?? []),
    ...(profile.style?.narrative ?? []),
  ];

  for (const value of input.userProvidedAttributes) {
    evidence.push({
      id: `user-${evidence.length}`,
      attribute: "user_provided",
      value,
      kind: "user_provided",
      source: "user input",
      confidence: "high",
    });
  }

  const locks = deriveCandidateLocks(profile);

  return ReferenceAssetSchema.parse({
    id: crypto.randomUUID(),
    type: input.type,
    name: input.name,
    sourceAssets: input.sourceAssets,
    profile,
    evidence,
    locks,
    negativeConstraints: [],
    version: 1,
    status: "review",
    createdAt: now,
    updatedAt: now,
  });
}
