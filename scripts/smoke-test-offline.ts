/**
 * Teste de ponta a ponta do Caminho B usando um LLM falso local (ver
 * mock-llm-server.ts) — não chama Groq nem OpenAI de verdade, então não
 * gasta tokens nem depende de cota. Valida o encadeamento real dos agentes,
 * o schema Zod de cada um, o loop de compliance e a injeção do ator
 * principal (preset Jesus). Não substitui o smoke-test com IA de verdade —
 * é pra iterar rápido no código sem esperar reset de cota.
 * Uso: npm run smoke-test:offline
 */
import { startMockLLMServer } from "./mock-llm-server";

async function main() {
  const mock = await startMockLLMServer();
  process.env.GROQ_BASE_URL = `${mock.url}/openai/v1`;
  process.env.OPENAI_BASE_URL = `${mock.url}/v1`;
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "mock";
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "mock";

  try {
    const { runPipeline, ManualEditRequiredError } = await import("../src/core/pipeline");
    const { JESUS_KRONIA } = await import("../src/core/generation/actor-presets");
    const { ContentRequestSchema } = await import("../src/types/pipeline");

    const request = ContentRequestSchema.parse({
      project: "jeova_fala",
      objective: "educar",
      mode: "organico",
      productPhotoUrl: null,
      productInfo: [
        { text: "Tema: a parábola do filho pródigo e o perdão", kind: "fato", source: "campo de informações" },
      ],
      referenceVideoUrl: null,
      actorProfile: JESUS_KRONIA,
      targetDurationSeconds: 30,
    });

    console.log("Rodando pipeline OFFLINE (mock LLM local, sem custo nem cota)...\n");

    try {
      const output = await runPipeline(request);
      console.log("OK — pipeline completo (recomendação → geração → compliance) rodou sem erro de tipo/schema.");
      console.log(`Agentes no roteiro final: ${output.generation.scenes.length} cenas.`);
      console.log(`Ator principal usado: ${request.actorProfile?.name}.`);
      console.log(`Compliance aprovado: ${output.compliance.approved}.`);
    } catch (err) {
      if (err instanceof ManualEditRequiredError) {
        console.log("Pipeline rodou até o fim; compliance reprovou os dados fake (esperado) e");
        console.log("o teto de correção automática funcionou como projetado (escalou pra manual).");
        return;
      }
      throw err;
    }
  } finally {
    await mock.stop();
  }
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exitCode = 1;
});
