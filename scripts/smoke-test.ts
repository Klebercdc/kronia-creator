/**
 * Teste manual de ponta a ponta do Caminho B (sem vídeo de referência).
 * Uso: npm run smoke-test
 */
import "dotenv/config";
import { runPipeline, ManualEditRequiredError } from "../src/core/pipeline";
import type { ContentRequest } from "../src/types/pipeline";

const request: ContentRequest = {
  project: "comercial",
  objective: "vender",
  mode: "tiktok_shop",
  productPhotoUrl: null,
  productInfo: [
    { text: "Copo térmico com estampa 'Jesus' e cruz", kind: "fato", source: "campo de informações" },
    { text: "Mantém temperatura por várias horas", kind: "fato", source: "campo de informações" },
  ],
  referenceVideoUrl: null,
};

async function main() {
  console.log("Rodando pipeline (Caminho B)...\n");
  try {
    const output = await runPipeline(request);
    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    if (err instanceof ManualEditRequiredError) {
      console.log("Compliance reprovou após o teto de correção automática:");
      console.log(JSON.stringify(err.output.compliance, null, 2));
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
