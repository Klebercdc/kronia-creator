import { analyzeActorImage } from "../generation/actor-vision";
import { analyzeProductImage } from "../generation/product-vision";
import type { VideoAnalysis } from "../../types/video-analysis";
import type {
  CharacterProfile,
  ProductProfile,
  ReferenceEvidence,
  StylePatternProfile,
} from "../../types/reference-studio";

function evidence(
  id: string,
  attribute: string,
  value: string,
  source: string,
  kind: ReferenceEvidence["kind"] = "observed",
): ReferenceEvidence {
  return {
    id,
    attribute,
    value,
    kind,
    source,
    confidence: kind === "unknown" ? "low" : "high",
  };
}

export async function buildCharacterProfile(imageDataUrl: string): Promise<CharacterProfile> {
  const appearance = await analyzeActorImage(imageDataUrl);
  const item = evidence("character-appearance", "appearance", appearance, "actor image");

  return {
    identity: [item],
    body: [],
    wardrobe: [],
    voicePerformance: [],
  };
}

export async function buildProductProfile(imageDataUrls: string[]): Promise<ProductProfile> {
  const visualDescription = await analyzeProductImage(imageDataUrls);
  return {
    visualAttributes: [
      evidence("product-visual-description", "visual_description", visualDescription, "product image(s)"),
    ],
    claims: [],
  };
}

export function buildStylePatternProfile(analysis: VideoAnalysis): StylePatternProfile {
  const source = "video reference analysis";
  return {
    hook: [
      evidence("style-hook-type", "hook_type", analysis.hook.type, source),
      ...(analysis.hook.text
        ? [evidence("style-hook-text", "hook_text", analysis.hook.text, source, "derived")]
        : []),
    ],
    structure: analysis.structure.map((value, index) =>
      evidence(`style-structure-${index}`, "structure", value, source),
    ),
    pacing: [
      evidence("style-cuts-per-minute", "cuts_per_minute", String(analysis.visual.cutsPerMinute), source),
    ],
    framing: [evidence("style-framing", "framing", analysis.visual.framing, source)],
    camera: [evidence("style-camera", "camera", analysis.visual.camera, source)],
    lighting: [],
    composition: [],
    performance: [],
    narrative: [],
  };
}
