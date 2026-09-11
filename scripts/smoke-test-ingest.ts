/**
 * Teste manual da Ingestão sozinha (download + frames + transcript + visão).
 * Uso: npm run smoke-test:ingest -- <url-do-video>
 */
import "dotenv/config";
import { ingest } from "../src/core/ingestion/ingest";

const url = process.argv[2];
if (!url) {
  console.error("Uso: npm run smoke-test:ingest -- <url-do-video>");
  process.exit(1);
}

ingest({ kind: "url", url })
  .then((analysis) => console.log(JSON.stringify(analysis, null, 2)))
  .catch((err) => {
    console.error("Falhou:", err);
    process.exit(1);
  });
