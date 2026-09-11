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
    nitro(),
    // o plugin do react precisa vir depois do plugin do start
    viteReact(),
  ],
});
