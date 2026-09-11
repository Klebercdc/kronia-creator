import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    // nitro() é o que faz o build virar função serverless reconhecível pelo
    // Vercel (zero-config) — sem ele, o Vercel só serve o client como
    // estático e o server.js gerado nunca roda, dando 404 em produção.
    //
    // vercel.functions.maxDuration sobe o limite de execução da função pro
    // teto do plano Hobby (60s) — sem isso, o default é bem menor (10s) e
    // o pipeline (baixar vídeo + até 10 chamadas de IA em sequência) estoura
    // fácil, aparecendo pro usuário como "Load failed" (erro de rede genérico
    // do navegador, não um erro do meu código — é o Vercel matando a função
    // no meio e cortando a conexão).
    nitro({
      vercel: { functions: { maxDuration: 60 } },
    }),
    // o plugin do react precisa vir depois do plugin do start
    viteReact(),
  ],
});
