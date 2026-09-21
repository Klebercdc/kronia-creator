import { buildCharacterProfile, buildProductProfile, buildStylePatternProfile } from "./profiles";
import { deriveCandidateLocks } from "./locks";
import {
  ReferenceAssetSchema,
  ReferenceStudioInputSchema,
  type ReferenceAsset,
  type ReferenceEvidence,
  type ReferenceLock,
  type ReferenceLockType,
  type ReferenceStudioInput,
} from "../../types/reference-studio";
import type { VideoAnalysis } from "../../types/video-analysis";

function userLockType(type: ReferenceStudioInput["type"]): ReferenceLockType {
  if (type === "person") return "identity";
  if (type === "product") return "product_fidelity";
  return "style_pattern";
}

function lockFromEvidence(
  evidence: ReferenceEvidence,
  type: ReferenceLockType,
  priority: ReferenceLock["priority"] = "high",
): ReferenceLock {
  return {
    id: `lock-${type}-${evidence.id}`,
    type,
    attribute: evidence.attribute,
    value: evidence.value,
    priority,
    sourceEvidenceIds: [evidence.id],
    variable: false,
  };
}

export async function analyzeReferenceAsset(params: {
  input: ReferenceStudioInput;
  imageDataUrls?: string[];
  videoAnalysis?: VideoAnalysis | null;
  now?: string;
}): Promise<ReferenceAsset> {
  const input = ReferenceStudioInputSchema.parse(params.input);
  const now = params.now ?? new Date().toISOString();

  if (input.type === "combination") {
    throw new Error(
      'Referências "combination" exigem mapeamento explícito de papéis. Analise personagem, produto e estilo separadamente antes de combiná-los.',
    );
  }

  const profile: ReferenceAsset["profile"] = {
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

  const evidence: ReferenceEvidence[] = [
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

  const userEvidence = input.userProvidedAttributes.map<ReferenceEvidence>((value, index) => ({
    id: `user-${index}`,
    attribute: "user_provided",
    value,
    kind: "user_provided",
    source: "user input",
    confidence: "high",
  }));
  evidence.push(...userEvidence);

  const negativeEvidence = input.negativeConstraints.map<ReferenceEvidence>((value, index) => ({
    id: `negative-${index}`,
    attribute: "negative_visual",
    value,
    kind: "user_provided",
    source: "user input",
    confidence: "high",
  }));
  evidence.push(...negativeEvidence);

  const locks = [
    ...deriveCandidateLocks(profile),
    ...userEvidence.map((item) => lockFromEvidence(item, userLockType(input.type))),
    ...negativeEvidence.map((item) => lockFromEvidence(item, "negative_visual", "critical")),
  ];

  return ReferenceAssetSchema.parse({
    id: crypto.randomUUID(),
    type: input.type,
    name: input.name,
    sourceAssets: input.sourceAssets,
    profile,
    evidence,
    locks,
    negativeConstraints: input.negativeConstraints,
    version: 1,
    status: "review",
    createdAt: now,
    updatedAt: now,
  });
}
