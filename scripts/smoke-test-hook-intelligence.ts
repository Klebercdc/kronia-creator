import assert from "node:assert/strict";
import type { ClassificationResult, ContentRequest } from "../src/types/pipeline";
import {
  HOOK_LIBRARY,
  buildHookIntelligenceBrief,
  selectHookPatterns,
} from "../src/core/generation/hook-engine";

const request:ContentRequest={
  project:"comercial",
  objective:"vender",
  mode:"tiktok_shop",
  productPhotoUrls:[],
  productInfo:[{text:"Conjunto amarelo com botões frontais",kind:"fato",source:"foto do produto"}],
  referenceVideoUrl:null,
  referenceVideoStoragePath:null,
  actorProfile:null,
  targetDurationSeconds:20,
};

const reference:ClassificationResult={
  formatPrimary:"ugc",
  formatSecondary:null,
  hookType:"result_first",
  narrativeStructure:["hook","demonstração","cta"],
  pacing:"rapido",
  persuasionMechanisms:["curiosidade","beneficio"],
  derivedFromReference:true,
};

assert.equal(HOOK_LIBRARY.length,100,"o catálogo precisa manter 100 mecânicas");

const selected=selectHookPatterns(request,null);
assert.equal(selected.length,5);
assert.equal(new Set(selected.map((item)=>item.family)).size,5,"as cinco famílias precisam ser diferentes");
assert.deepEqual(selected,selectHookPatterns(request,null),"a seleção precisa ser determinística");

const referenceSelected=selectHookPatterns(request,reference);
assert.ok(
  ["result","demo","reveal"].includes(referenceSelected[0]?.family),
  "o hook da referência precisa liderar a seleção",
);

const signatures=new Set(
  Array.from({length:12},(_,index)=>{
    const contextualRequest:ContentRequest={
      ...request,
      productInfo:[{text:`Produto factual ${index}`,kind:"fato",source:"campo de informações"}],
    };
    return selectHookPatterns(contextualRequest,null).map((item)=>item.id).join(",");
  }),
);
assert.ok(signatures.size>1,"produtos diferentes precisam percorrer variantes diferentes");

const allFamilies=selectHookPatterns(request,null,100);
assert.equal(allFamilies.length,20,"o limite deve ser o total de famílias");
assert.equal(new Set(allFamilies.map((item)=>item.family)).size,20);

const brief=buildHookIntelligenceBrief(request,reference);
assert.match(brief,/REFERÊNCIA ATIVA/);
assert.match(brief,/result_first/);
assert.match(brief,/Não invente números/);
assert.match(brief,/selectedHook deve ser exatamente/);

console.log("Hook Intelligence: testes concluídos com sucesso.");
