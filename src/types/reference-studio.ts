import { z } from "zod";

export const ReferenceAssetTypeSchema = z.enum(["person", "product", "video_style", "combination"]);
export type ReferenceAssetType = z.infer<typeof ReferenceAssetTypeSchema>;

export const ReferenceAssetStatusSchema = z.enum([
  "draft",
  "analyzing",
  "review",
  "locked",
  "archived",
]);
export type ReferenceAssetStatus = z.infer<typeof ReferenceAssetStatusSchema>;

export const ReferenceEvidenceKindSchema = z.enum([
  "observed",
  "user_provided",
  "derived",
  "unknown",
]);
export type ReferenceEvidenceKind = z.infer<typeof ReferenceEvidenceKindSchema>;

export const ReferenceEvidenceSchema = z.object({
  id: z.string().min(1),
  attribute: z.string().min(1),
  value: z.string(),
  kind: ReferenceEvidenceKindSchema,
  source: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});
export type ReferenceEvidence = z.infer<typeof ReferenceEvidenceSchema>;

export const ReferenceLockTypeSchema = z.enum([
  "identity",
  "body",
  "wardrobe",
  "voice_performance",
  "product_identity",
  "product_fidelity",
  "product_scale",
  "style_pattern",
  "negative_visual",
]);
export type ReferenceLockType = z.infer<typeof ReferenceLockTypeSchema>;

export const ReferenceLockSchema = z.object({
  id: z.string().min(1),
  type: ReferenceLockTypeSchema,
  attribute: z.string().min(1),
  value: z.string(),
  priority: z.enum(["critical", "high", "normal"]),
  sourceEvidenceIds: z.array(z.string().min(1)),
  variable: z.boolean(),
});
export type ReferenceLock = z.infer<typeof ReferenceLockSchema>;

export const ReferenceContextSchema = z.object({
  assetIds: z.array(z.string().min(1)),
  locks: z.array(ReferenceLockSchema),
  negativeConstraints: z.array(z.string().min(1)).default([]),
  version: z.number().int().positive(),
});
export type ReferenceContext = z.infer<typeof ReferenceContextSchema>;

export const CharacterProfileSchema = z.object({
  identity: z.array(ReferenceEvidenceSchema),
  body: z.array(ReferenceEvidenceSchema),
  wardrobe: z.array(ReferenceEvidenceSchema),
  voicePerformance: z.array(ReferenceEvidenceSchema),
});
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;

export const ProductProfileSchema = z.object({
  visualAttributes: z.array(ReferenceEvidenceSchema),
  claims: z.array(ReferenceEvidenceSchema),
});
export type ProductProfile = z.infer<typeof ProductProfileSchema>;

export const StylePatternProfileSchema = z.object({
  hook: z.array(ReferenceEvidenceSchema),
  structure: z.array(ReferenceEvidenceSchema),
  pacing: z.array(ReferenceEvidenceSchema),
  framing: z.array(ReferenceEvidenceSchema),
  camera: z.array(ReferenceEvidenceSchema),
  lighting: z.array(ReferenceEvidenceSchema),
  composition: z.array(ReferenceEvidenceSchema),
  performance: z.array(ReferenceEvidenceSchema),
  narrative: z.array(ReferenceEvidenceSchema),
});
export type StylePatternProfile = z.infer<typeof StylePatternProfileSchema>;

export const ReferenceProfileSchema = z.object({
  character: CharacterProfileSchema.nullable(),
  product: ProductProfileSchema.nullable(),
  style: StylePatternProfileSchema.nullable(),
});
export type ReferenceProfile = z.infer<typeof ReferenceProfileSchema>;

export const ReferenceVersionSchema = z.object({
  version: z.number().int().positive(),
  profile: ReferenceProfileSchema,
  locks: z.array(ReferenceLockSchema),
  negativeConstraints: z.array(z.string()),
  createdAt: z.string(),
});
export type ReferenceVersion = z.infer<typeof ReferenceVersionSchema>;

export const ReferenceAssetSchema = z.object({
  id: z.string().min(1),
  type: ReferenceAssetTypeSchema,
  name: z.string().min(1),
  sourceAssets: z.array(z.string().min(1)),
  profile: ReferenceProfileSchema,
  evidence: z.array(ReferenceEvidenceSchema),
  locks: z.array(ReferenceLockSchema),
  negativeConstraints: z.array(z.string()),
  version: z.number().int().positive(),
  status: ReferenceAssetStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReferenceAsset = z.infer<typeof ReferenceAssetSchema>;

export const ReferenceStudioInputSchema = z.object({
  type: ReferenceAssetTypeSchema,
  name: z.string().min(1),
  sourceAssets: z.array(z.string().min(1)).min(1),
  userProvidedAttributes: z.array(z.string().min(1)).default([]),
  negativeConstraints: z.array(z.string().min(1)).default([]),
});
export type ReferenceStudioInput = z.infer<typeof ReferenceStudioInputSchema>;
