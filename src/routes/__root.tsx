import type { ReactNode } from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { TEMA_ANTI_FLASH_SCRIPT } from "../lib/theme";
import { useViewportKeyboardLock } from "../hooks/useViewportKeyboardLock";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "KRONIA — Criador Inteligente" },
      // #FAF9F7 = --kr-bg claro (tema padrão do app desde o retema) — antes
      // ficava #17171a (escuro), de quando as abas internas eram sempre
      // escuras; destoava da barra do Safari/status bar contra o app agora
      // claro por padrão (relatado como tarja/faixa de cor errada colada na
      // borda da tela no iPhone).
      { name: "theme-color", content: "#FAF9F7" },
      // iOS: faz "Adicionar à Tela de Início" abrir em tela cheia, sem a barra do Safari.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "KRONIA" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // Global de propósito — teclado empurra o viewport do app inteiro, não só
  // de uma tela. Ver src/hooks/useViewportKeyboardLock.ts.
  useViewportKeyboardLock();
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo ANTES do primeiro paint — ver src/lib/theme.ts.
            Precisa vir antes de qualquer conteúdo pra não piscar claro→escuro. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_ANTI_FLASH_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
