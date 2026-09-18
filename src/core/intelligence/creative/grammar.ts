i

export const CreativeBeatSchema = z.object({
  id: z.string(),
  action: z.string(),
  purpose: z.string(),
  interaction: z.enum(PRODUCT_INTERACTION_GRAMMAR).optional(),
  durationWeight: z.number().positive(),
});

export const CreativeGrammarSchema = z.object({
  version: z.literal(CREATIVE_GRAMMAR_VERSION),
  variationSeed: z.string().min(1),
  format: z.string(),
  pattern: z.string(),
  mechanic: z.string(),
  beats: z.array(CreativeBeatSchema).min(1),
  camera: z.array(z.enum(CAMERA_GRAMMAR)).min(1),
  performance: z.enum(PERFORMANCE_GRAMMAR),
  environment: z.enum(ENVIRONMENT_GRAMMAR),
  productInteraction: z.array(z.enum(PRODUCT_INTERACTION_GRAMMAR)),
  audio: z.array(z.enum(AUDIO_GRAMMAR)).min(1),
  realism: z.array(z.enum(VISUAL_REALISM_GRAMMAR)).min(1),
});
mport { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ContentFormat } from "../../../types/taxonomy";
import type { CreativePattern, VisualMechanic } from "./schemas";

export const CREATIVE_GRAMMAR_VERSION = "v1";

export const CAMERA_GRAMMAR = [
  "FIRST_PERSON",
  "HANDHELD_SMARTPHONE",
  "SELFIE",
  "FOLLOW_HANDS",
  "OVER_SHOULDER",
  "TABLETOP",
  "MACRO",
  "CLOSE_UP",
  "MEDIUM",
  "WIDE",
  "WALKING_FOLLOW",
  "MIRROR",
  "STATIC_PHONE",
] as const;
export type CameraGrammar = (typeof CAMERA_GRAMMAR)[number];

export const PERFORMANCE_GRAMMAR = [
  "NATURAL",
  "CURIOUS",
  "EXCITED",
  "SURPRISED",
  "CALM",
  "CONVINCED",
  "RELATABLE",
  "SPONTANEOUS",
  "FOCUSED",
  "REASSURED",
] as const;
export type PerformanceGrammar = (typeof PERFORMANCE_GRAMMAR)[number];

export const ENVIRONMENT_GRAMMAR = [
  "HOME",
  "KITCHEN",
  "BEDROOM",
  "BATHROOM",
  "CAR",
  "STREET",
  "STORE",
  "OFFICE",
  "GYM",
  "OUTDOOR",
  "TABLETOP_STUDIO",
] as const;
export type EnvironmentGrammar = (typeof ENVIRONMENT_GRAMMAR)[number];

export const PRODUCT_INTERACTION_GRAMMAR = [
  "RECEIVE",
  "HOLD",
  "OPEN",
  "TOUCH",
  "ROTATE",
  "COMPARE",
  "WEAR",
  "USE",
  "APPLY",
  "ASSEMBLE",
  "INSPECT",
  "SHOW_DETAIL",
  "PUT_ON",
  "REMOVE",
] as const;
export type ProductInteractionGrammar = (typeof PRODUCT_INTERACTION_GRAMMAR)[number];

export const AUDIO_GRAMMAR = [
  "PACKAGING_SOUND",
  "FABRIC_SOUND",
  "CLICK",
  "ZIPPER",
  "RUSTLE",
  "NATURAL_ROOM_TONE",
  "FOOTSTEPS",
  "HANDLING_SOUND",
  "PRODUCT_CONTACT",
  "QUIET_VOICE",
  "NATURAL_SPEECH",
] as const;
export type AudioGrammar = (typeof AUDIO_GRAMMAR)[number];

export const VISUAL_REALISM_GRAMMAR = [
  "HANDHELD",
  "IMPERFECT_FRAMING",
  "SUBTLE_AUTOFOCUS",
  "NATURAL_DAYLIGHT",
  "REALISTIC_MOTION",
  "NON_CINEMATIC",
  "SMARTPHONE_LOOK",
  "NATURAL_EXPOSURE",
  "REALISTIC_DEPTH",
  "MICRO_CAMERA_JITTER",
] as const;
export type VisualRealismGrammar = (typeof VISUAL_REALISM_GRAMMAR)[number];

export interface CreativeBeat {
  id: string;
  action: string;
  purpose: string;
  interaction?: ProductInteractionGrammar;
  durationWeight: number;
}

export interface CreativeGrammar {
  version: typeof CREATIVE_GRAMMAR_VERSION;
  variationSeed: string;
  format: ContentFormat;
  pattern: CreativePattern;
  mechanic: VisualMechanic;
  beats: CreativeBeat[];
  camera: CameraGrammar[];
  performance: PerformanceGrammar;
  environment: EnvironmentGrammar;
  productInteraction: ProductInteractionGrammar[];
  audio: AudioGrammar[];
  realism: VisualRealismGrammar[];
}

/**
 * Grammar is data, not prompt text. Each mechanic describes reusable
 * micro-actions that can be composed by the existing Creative Spec/Shot
 * Pattern rather than stored as a giant prompt.
 */
export const MECHANIC_BEATS: Record<string, CreativeBeat[]> = {
  unboxing: [
    { id: "RECEIVE", action: "receive the package", purpose: "establish the arrival", interaction: "RECEIVE", durationWeight: 0.8 },
    { id: "PACKAGE_LOOK", action: "look at the package before opening", purpose: "create anticipation", durationWeight: 0.7 },
    { id: "OPEN_PACKAGE", action: "open the package", purpose: "start the reveal", interaction: "OPEN", durationWeight: 1 },
    { id: "OPENING_FRICTION", action: "work naturally through the opening", purpose: "retain physical realism", durationWeight: 0.6 },
    { id: "PRODUCT_REVEAL", action: "reveal the product", purpose: "deliver the discovery", durationWeight: 1 },
    { id: "LIFT_PRODUCT", action: "lift the product into view", purpose: "establish scale", interaction: "HOLD", durationWeight: 0.8 },
    { id: "DETAIL_SHOWCASE", action: "show a relevant visible detail", purpose: "support product fidelity", interaction: "SHOW_DETAIL", durationWeight: 0.9 },
  ],
  door_to_table: [
    { id: "RECEIVE", action: "receive the package", purpose: "start the journey", interaction: "RECEIVE", durationWeight: 0.8 },
    { id: "APPROACH", action: "approach the camera naturally", purpose: "create movement", durationWeight: 0.8 },
    { id: "ENTER_HOME", action: "enter the home while carrying it", purpose: "move into context", interaction: "HOLD", durationWeight: 1 },
    { id: "WALK_TO_TABLE", action: "walk to the table", purpose: "connect locations", durationWeight: 1 },
    { id: "PLACE_PACKAGE", action: "place the package on the table", purpose: "prepare the reveal", durationWeight: 0.8 },
    { id: "OPEN_PACKAGE", action: "open the package on the table", purpose: "begin the reveal", interaction: "OPEN", durationWeight: 1 },
    { id: "PRODUCT_REVEAL", action: "reveal the product", purpose: "payoff", durationWeight: 1 },
  ],
  mirror_showcase: [
    { id: "MIRROR_ENTRY", action: "enter the mirror frame", purpose: "establish the look", durationWeight: 0.8 },
    { id: "LOOK_CHECK", action: "check the look naturally", purpose: "create relatability", durationWeight: 0.7 },
    { id: "TURN", action: "turn naturally to reveal the silhouette", purpose: "show form", interaction: "ROTATE", durationWeight: 0.9 },
    { id: "DETAIL_SHOWCASE", action: "move closer to show a visible detail", purpose: "support fidelity", interaction: "SHOW_DETAIL", durationWeight: 0.8 },
  ],
  close_up_detail: [
    { id: "DETAIL_START", action: "start on the relevant product detail", purpose: "immediate visual hook", durationWeight: 0.8 },
    { id: "HAND_INTERACTION", action: "touch or handle the visible detail naturally", purpose: "ground the shot", interaction: "TOUCH", durationWeight: 0.8 },
    { id: "REVEAL_CONTEXT", action: "pull back enough to reveal context and scale", purpose: "restore spatial understanding", durationWeight: 1 },
  ],
  follow_hands: [
    { id: "HAND_ENTRY", action: "hands enter frame with the product", purpose: "start in action", interaction: "HOLD", durationWeight: 0.8 },
    { id: "HANDLE", action: "handle the product naturally", purpose: "show physical interaction", interaction: "USE", durationWeight: 1 },
    { id: "DETAIL", action: "pause briefly on a visible detail", purpose: "support fidelity", interaction: "SHOW_DETAIL", durationWeight: 0.8 },
  ],
  pocket_reveal: [
    { id: "POCKET_ENTRY", action: "reach into a pocket or bag", purpose: "create curiosity", durationWeight: 0.8 },
    { id: "PULL_OUT", action: "pull the product into view", purpose: "reveal", interaction: "RECEIVE", durationWeight: 0.9 },
    { id: "SHOW", action: "hold it clearly at natural scale", purpose: "establish product identity", interaction: "HOLD", durationWeight: 0.8 },
  ],
  bag_reveal: [
    { id: "BAG_OPEN", action: "open the bag", purpose: "create anticipation", interaction: "OPEN", durationWeight: 0.8 },
    { id: "REVEAL", action: "reveal the product inside", purpose: "payoff", durationWeight: 1 },
    { id: "LIFT", action: "lift it into a clear view", purpose: "establish identity and scale", interaction: "HOLD", durationWeight: 0.8 },
  ],
  phone_screen_reveal: [
    { id: "SCREEN_ENTRY", action: "bring the phone screen into frame", purpose: "create information curiosity", durationWeight: 0.8 },
    { id: "SCREEN_REVEAL", action: "reveal the relevant screen content", purpose: "deliver the information", durationWeight: 1 },
    { id: "PRODUCT_CONTEXT", action: "connect the screen to the product context", purpose: "payoff", durationWeight: 0.8 },
  ],
  product_rotation: [
    { id: "HOLD", action: "hold the product at natural scale", purpose: "establish identity", interaction: "HOLD", durationWeight: 0.8 },
    { id: "ROTATE", action: "rotate the product slowly enough to preserve geometry", purpose: "show form and construction", interaction: "ROTATE", durationWeight: 1 },
    { id: "DETAIL", action: "pause on a visible detail", purpose: "fidelity", interaction: "SHOW_DETAIL", durationWeight: 0.8 },
  ],
  detail_reveal: [
    { id: "CLOSE_DETAIL", action: "begin with a relevant close detail", purpose: "hook", durationWeight: 0.8 },
    { id: "TRACK_DETAIL", action: "track across the visible construction", purpose: "inspection", interaction: "INSPECT", durationWeight: 1 },
    { id: "CONTEXT", action: "reveal the wider product context", purpose: "scale", durationWeight: 0.8 },
  ],
  functional_demo: [
    { id: "SETUP", action: "position the product for the demonstrated use", purpose: "clarify the action", durationWeight: 0.8 },
    { id: "USE", action: "perform the supported use naturally", purpose: "demonstrate", interaction: "USE", durationWeight: 1.2 },
    { id: "RESULT", action: "show the visible result without inventing claims", purpose: "payoff", durationWeight: 1 },
  ],
  try_on: [
    { id: "BASE", action: "establish the person before the change", purpose: "context", durationWeight: 0.8 },
    { id: "PUT_ON", action: "put on the garment naturally", purpose: "interaction", interaction: "PUT_ON", durationWeight: 1 },
    { id: "SHOW_LOOK", action: "show the final look through natural movement", purpose: "payoff", interaction: "SHOW_DETAIL", durationWeight: 1 },
  ],
  comparison: [
    { id: "OPTION_A", action: "show the first option clearly", purpose: "baseline", durationWeight: 0.8 },
    { id: "OPTION_B", action: "show the second option clearly", purpose: "contrast", durationWeight: 0.8 },
    { id: "DIFFERENCE", action: "focus on the visible difference", purpose: "decision support", interaction: "COMPARE", durationWeight: 1 },
  ],
  reaction: [
    { id: "REACTION_START", action: "capture the first natural reaction", purpose: "human hook", durationWeight: 0.8 },
    { id: "SHOW_OBJECT", action: "bring the product into view", purpose: "connect reaction to product", interaction: "HOLD", durationWeight: 0.9 },
    { id: "PAYOFF", action: "complete the reaction with a clear visual payoff", purpose: "close the loop", durationWeight: 1 },
  ],
  walk_and_talk: [
    { id: "WALK", action: "walk naturally while addressing the camera", purpose: "native UGC movement", durationWeight: 1 },
    { id: "SHOW", action: "bring the product into the interaction", purpose: "integrate product", interaction: "HOLD", durationWeight: 0.9 },
    { id: "PAYOFF", action: "finish the thought while continuing the movement", purpose: "payoff", durationWeight: 1 },
  ],
};

const MECHANIC_ALIASES: Record<string, keyof typeof MECHANIC_BEATS> = {
  door_to_table: "door_to_table",
  package_reveal: "unboxing",
  layer_by_layer_reveal: "unboxing",
  pocket_reveal: "pocket_reveal",
  bag_reveal: "bag_reveal",
  phone_screen_reveal: "phone_screen_reveal",
  close_up_detail: "close_up_detail",
  follow_hands: "follow_hands",
  mirror_showcase: "mirror_showcase",
  tabletop_demo: "functional_demo",
  product_rotation: "product_rotation",
  walk_and_talk: "walk_and_talk",
};

const FORMAT_MECHANICS: Partial<Record<ContentFormat, Array<keyof typeof MECHANIC_BEATS>>> = {
  ugc: ["reaction", "walk_and_talk", "follow_hands", "close_up_detail"],
  pov: ["follow_hands", "pocket_reveal", "walk_and_talk"] as any,
  unboxing: ["door_to_table", "unboxing", "bag_reveal", "package_reveal"] as any,
  review: ["reaction", "close_up_detail", "product_rotation"] as any,
  demonstracao: ["functional_demo", "follow_hands", "close_up_detail"] as any,
  produto_em_uso: ["functional_demo", "follow_hands", "walk_and_talk"] as any,
  comparacao: ["comparison", "close_up_detail"] as any,
  storytelling: ["walk_and_talk", "reaction", "door_to_table"] as any,
  produto_360: ["product_rotation", "close_up_detail"] as any,
  apresentacao_por_modelo: ["mirror_showcase", "walk_and_talk", "product_rotation"] as any,
  antes_e_depois: ["try_on", "comparison", "mirror_showcase"] as any,
  product_showcase: ["product_rotation", "detail_reveal", "close_up_detail"] as any,
  teste: ["functional_demo", "reaction", "close_up_detail"] as any,
  tutorial: ["functional_demo", "follow_hands", "walk_and_talk"] as any,
  cinematografico: ["detail_reveal", "product_rotation", "reaction"] as any,
};

const CAMERA_BY_MECHANIC: Record<string, CameraGrammar[]> = {
  door_to_table: ["HANDHELD_SMARTPHONE", "WALKING_FOLLOW"],
  unboxing: ["HANDHELD_SMARTPHONE", "TABLETOP", "CLOSE_UP"],
  mirror_showcase: ["MIRROR", "SELFIE", "MEDIUM"],
  close_up_detail: ["MACRO", "CLOSE_UP", "HANDHELD_SMARTPHONE"],
  follow_hands: ["FOLLOW_HANDS", "FIRST_PERSON", "CLOSE_UP"],
  pocket_reveal: ["FIRST_PERSON", "HANDHELD_SMARTPHONE", "CLOSE_UP"],
  bag_reveal: ["HANDHELD_SMARTPHONE", "CLOSE_UP", "TABLETOP"],
  phone_screen_reveal: ["HANDHELD_SMARTPHONE", "CLOSE_UP", "OVER_SHOULDER"],
  product_rotation: ["TABLETOP", "HANDHELD_SMARTPHONE", "CLOSE_UP"],
  detail_reveal: ["MACRO", "CLOSE_UP", "HANDHELD_SMARTPHONE"],
  functional_demo: ["TABLETOP", "OVER_SHOULDER", "HANDHELD_SMARTPHONE"],
  try_on: ["MIRROR", "MEDIUM", "HANDHELD_SMARTPHONE"],
  comparison: ["MEDIUM", "TABLETOP", "HANDHELD_SMARTPHONE"],
  reaction: ["SELFIE", "HANDHELD_SMARTPHONE", "MEDIUM"],
  walk_and_talk: ["WALKING_FOLLOW", "SELFIE", "HANDHELD_SMARTPHONE"],
};

const ENVIRONMENT_BY_FORMAT: Partial<Record<ContentFormat, EnvironmentGrammar[]>> = {
  ugc: ["HOME", "BEDROOM", "KITCHEN", "OFFICE", "STREET"],
  pov: ["HOME", "CAR", "STREET", "STORE"],
  unboxing: ["HOME", "TABLETOP_STUDIO", "OFFICE"],
  review: ["HOME", "OFFICE", "GYM"],
  tutorial: ["KITCHEN", "BATHROOM", "GYM", "OFFICE"],
  demonstracao: ["HOME", "KITCHEN", "BATHROOM", "GYM", "OFFICE"],
  produto_em_uso: ["HOME", "KITCHEN", "BATHROOM", "GYM", "OUTDOOR"],
  comparacao: ["HOME", "STORE", "TABLETOP_STUDIO"],
  storytelling: ["HOME", "STREET", "OUTDOOR", "OFFICE"],
  produto_360: ["TABLETOP_STUDIO", "HOME", "OFFICE"],
  apresentacao_por_modelo: ["HOME", "BEDROOM", "STORE", "STREET"],
};

const PERFORMANCE_BY_PATTERN: Partial<Record<CreativePattern, PerformanceGrammar[]>> = {
  prove_the_product: ["FOCUSED", "CONVINCED", "NATURAL"],
  discovery: ["CURIOUS", "SPONTANEOUS", "SURPRISED"],
  reveal: ["CURIOUS", "SURPRISED", "EXCITED"],
  transformation: ["EXCITED", "SURPRISED", "CONVINCED"],
  demonstration: ["FOCUSED", "NATURAL", "CONVINCED"],
  problem_solution: ["RELATABLE", "FOCUSED", "REASSURED"],
  curiosity: ["CURIOUS", "NATURAL", "SPONTANEOUS"],
  comparison: ["FOCUSED", "CURIOUS", "CONVINCED"],
  unboxing: ["EXCITED", "CURIOUS", "SPONTANEOUS"],
  first_use: ["CURIOUS", "SURPRISED", "NATURAL"],
  reaction: ["SURPRISED", "EXCITED", "RELATABLE"],
  social_proof: ["CONVINCED", "RELATABLE", "NATURAL"],
  before_after: ["SURPRISED", "CONVINCED", "EXCITED"],
};

const PRODUCT_INTERACTION_BY_PATTERN: Partial<Record<CreativePattern, ProductInteractionGrammar[]>> = {
  prove_the_product: ["HOLD", "INSPECT", "SHOW_DETAIL"],
  discovery: ["RECEIVE", "OPEN", "HOLD", "SHOW_DETAIL"],
  reveal: ["OPEN", "HOLD", "SHOW_DETAIL"],
  transformation: ["PUT_ON", "WEAR", "SHOW_DETAIL"],
  demonstration: ["HOLD", "USE", "SHOW_DETAIL"],
  problem_solution: ["COMPARE", "USE", "SHOW_DETAIL"],
  curiosity: ["HOLD", "OPEN", "INSPECT"],
  comparison: ["COMPARE", "SHOW_DETAIL"],
  unboxing: ["RECEIVE", "OPEN", "HOLD", "SHOW_DETAIL"],
  first_use: ["HOLD", "USE", "INSPECT"],
  reaction: ["HOLD", "SHOW_DETAIL"],
  before_after: ["PUT_ON", "WEAR", "COMPARE"],
};

const AUDIO_BY_MECHANIC: Partial<Record<string, AudioGrammar[]>> = {
  unboxing: ["PACKAGING_SOUND", "HANDLING_SOUND", "NATURAL_ROOM_TONE"],
  door_to_table: ["FOOTSTEPS", "HANDLING_SOUND", "NATURAL_ROOM_TONE"],
  mirror_showcase: ["NATURAL_SPEECH", "NATURAL_ROOM_TONE"],
  close_up_detail: ["PRODUCT_CONTACT", "NATURAL_ROOM_TONE"],
  follow_hands: ["HANDLING_SOUND", "PRODUCT_CONTACT", "NATURAL_ROOM_TONE"],
  pocket_reveal: ["FABRIC_SOUND", "HANDLING_SOUND"],
  bag_reveal: ["RUSTLE", "HANDLING_SOUND"],
  phone_screen_reveal: ["CLICK", "NATURAL_ROOM_TONE"],
  product_rotation: ["PRODUCT_CONTACT", "NATURAL_ROOM_TONE"],
  detail_reveal: ["PRODUCT_CONTACT", "NATURAL_ROOM_TONE"],
  functional_demo: ["PRODUCT_CONTACT", "NATURAL_SPEECH"],
  try_on: ["FABRIC_SOUND", "NATURAL_SPEECH"],
  comparison: ["NATURAL_SPEECH", "NATURAL_ROOM_TONE"],
  reaction: ["NATURAL_SPEECH", "NATURAL_ROOM_TONE"],
  walk_and_talk: ["FOOTSTEPS", "NATURAL_SPEECH"],
};

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash | 0);
}

function normalizedMechanic(mechanic: VisualMechanic): keyof typeof MECHANIC_BEATS {
  return MECHANIC_ALIASES[mechanic] ?? (mechanic as keyof typeof MECHANIC_BEATS);
}

export function resolveCreativeGrammar(args: {
  format: ContentFormat;
  pattern: CreativePattern;
  mechanic: VisualMechanic;
  seed?: string;
  productPresent?: boolean;
}): CreativeGrammar {
  const seed = args.seed ?? randomUUID();
  const numericSeed = hashSeed(seed);
  const requestedMechanic = normalizedMechanic(args.mechanic);
  const compatibleMechanics = FORMAT_MECHANICS[args.format] ?? (Object.keys(MECHANIC_BEATS) as Array<keyof typeof MECHANIC_BEATS>);
  // The existing Creative Reasoning chooses the creative direction; this
  // library chooses a concrete execution variant so similar requests do not
  // collapse into one template. The requested mechanic remains a preference
  // only when the target format has a single compatible variant.
  const compatibleKey = compatibleMechanics.length === 1
    ? compatibleMechanics[0]
    : pick(compatibleMechanics, numericSeed + (compatibleMechanics.includes(requestedMechanic) ? 1 : 0));
  const finalBeats = MECHANIC_BEATS[compatibleKey] ?? MECHANIC_BEATS.detail_reveal;
  const cameras = CAMERA_BY_MECHANIC[compatibleKey] ?? ["HANDHELD_SMARTPHONE", "MEDIUM"];
  const environments = ENVIRONMENT_BY_FORMAT[args.format] ?? ["HOME", "OUTDOOR"];
  const performances = PERFORMANCE_BY_PATTERN[args.pattern] ?? ["NATURAL", "SPONTANEOUS"];
  const interactions = PRODUCT_INTERACTION_BY_PATTERN[args.pattern] ?? ["HOLD", "SHOW_DETAIL"];
  const audio = AUDIO_BY_MECHANIC[compatibleKey] ?? ["NATURAL_ROOM_TONE", "NATURAL_SPEECH"];

  return {
    version: CREATIVE_GRAMMAR_VERSION,
    variationSeed: seed,
    format: args.format,
    pattern: args.pattern,
    mechanic: compatibleKey as VisualMechanic,
    beats: finalBeats,
    camera: [
      pick(cameras, numericSeed),
      pick(cameras, numericSeed + 1),
    ].filter((v, i, a) => a.indexOf(v) === i),
    performance: pick(performances, numericSeed + 2),
    environment: pick(environments, numericSeed + 3),
    productInteraction: productPresent ? interactions : [],
    audio,
    realism: ["HANDHELD", "REALISTIC_MOTION", "SMARTPHONE_LOOK", "SUBTLE_AUTOFOCUS"],
  };
}
