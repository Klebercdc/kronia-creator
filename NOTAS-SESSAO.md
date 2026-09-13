# Notas de handoff — sessão anterior (retomar aqui)

> Gerado pra uma sessão nova que abre este repo do zero (memória de conversa não atravessa sessões). Lê isso inteiro antes de mexer em qualquer coisa.

## Onde o código está (estado real do repo)

- Repo: `Klebercdc/kronia-adaptive-core`, branch `main`, HEAD real no momento desta nota: `39e3af8` ("Tema claro/escuro (escopado) + correções reais do menu lateral").
- Path local (se for o mesmo ambiente): `/home/user/kronia-adaptive-core`.
- Working tree tinha, além do HEAD: 2 scripts de teste **não commitados** (`scripts/_tmp_test_anel.ts`, `scripts/_tmp_test_conversation.ts`) — são scratch de teste, apagar/ignorar se não fizerem sentido no contexto novo.
- **Edição feita nesta sessão, ainda NÃO commitada** (usuário mandou parar antes do typecheck/commit):
  - `public/favicon-preto.png` (novo arquivo) — versão do `favicon.png` original com fundo preto sólido composto (o original é PNG com alpha transparente nos cantos — isso é a causa provável do ícone do PWA aparecer com fundo inconsistente/errado em instalações diferentes no iPhone, já que iOS não trata bem alpha em apple-touch-icon).
  - `public/manifest.json` — os dois `icons[].src` trocados de `/favicon.png` pra `/favicon-preto.png` (size ajustado pra `830x800`, tamanho real do arquivo).
  - `src/routes/__root.tsx` — `apple-touch-icon` trocado de `/favicon.png` pra `/favicon-preto.png`.
  - **Falta**: rodar `npx tsc --noEmit` + `npm run build`, revisar, e só então commitar/dar push (interrompido pelo usuário, `git status` deve mostrar tudo isso como pendente).

## Pra que serve o projeto (visão geral rápida)

KRONIA Creator: TanStack Start + Vite + React 19, Supabase (Postgres+Storage), OpenAI-only (`callStructuredText`/`callStructuredVisionFromDataUrls`, Zod strict). Pipeline de criação de roteiro/conteúdo (Ingestão→Classificação→Recomendação→Geração→Compliance), Opportunity Engine, Job Engine assíncrono (só pra trabalho longo tipo vídeo). `BLUEPRINT.md` no repo é a planta mestra (EXISTENTE/PLANEJADO/FUTURO por capacidade, auditado no código real).

## Trabalho grande já feito e commitado (até `39e3af8`)

1. **Fase 1** fechada (flowSegments determinístico, gestureMap, cliche-guard).
2. **BLUEPRINT.md** criado (auditoria real, não suposição).
3. **Fase 2 — Home virou conversa real com IA** (não mock, não é só um "seed" pro fluxo antigo de Criar):
   - Tabelas novas `creator_conversations` + `creator_conversation_messages` (Supabase, RLS "allow all" igual ao padrão já usado nas outras tabelas do projeto — app não tem auth).
   - `src/core/conversation/reply.ts` — `respondInConversation(history)`: 1 chamada LLM que decide `{reply, readyToCreate, productInfoText}`. **Nunca** escreve o roteiro final ela mesma — só decide quando tem informação suficiente pra disparar a pipeline real.
   - Quem dispara a pipeline de criação de verdade é o **cliente** (não uma function de servidor nova), usando as MESMAS RPCs que o fluxo `CriarFlow` já usa (`enqueueContentGeneration`/`advanceContentGenerationJob`) — sem duplicar pipeline.
   - Anexos: imagem = `dataUrl` inline (mesmo padrão de `analyzeProductPhoto`), vídeo = bucket já existente `creator-reference-videos` (mesmo de `uploadReferenceVideo`). **Não criar bucket novo** — isso foi tentado e revertido nesta sessão por instrução explícita do usuário ("Anexo de vídeo e imagem seio [sigo] o caminho anterior").
   - Imagem anexada é REALMENTE analisada: `visualDescription` preenchido no servidor (`sendMessageFn`) chamando `analyzeProductImage` (canal de visão já existente, o mesmo do botão "Analisar referência") — não fica um anexo inerte.
   - Voz: `src/core/conversation/voice.ts` — `transcribeVoiceMessage` via Whisper direto no áudio gravado no browser (sem ffmpeg).
   - `src/server/conversation.functions.ts` — RPCs: `createConversationFn`, `listConversationsFn`, `getConversationFn`, `sendMessageFn`, `appendConversationResultFn` (devolve o resultado do Job Engine pra dentro da conversa), `transcribeVoiceMessageFn`.
   - "+Novo bate-papo" cria conversa nova de verdade; "Recentes" na sidebar lista `creator_conversations` reais.

4. **Menu lateral com física de mola real** — porte 1:1 de `agenda-/js/mobile-core.js` (`mobMenuMola`, removida de lá no commit `07f879a`, recuperada do histórico git antes da remoção):
   - `src/hooks/useMenuSpring.ts` — mass-spring-damper (RESPOSTA=.14, AMORT=.76, integração em passo fixo 1/240s), alimentado por rampa em S (não salto direto pro alvo) — dá aquele movimento "pesado"/natural com leve overshoot, igual o motor antigo do agenda-.
   - Arquitetura de 3 camadas (também portada de agenda-): `.kronia-palco` → `.kronia-menu-camada` (menu, sempre atrás, z-index:0) → `.kronia-menu-veu` (só visual, `pointer-events:none` sempre) → `.kronia-app-camada` (app inteiro, z-index:1, desliza pra frente revelando o menu que tava atrás — **o menu não desliza por cima do app**, o app é que desliza pra abrir espaço) → `.kronia-app-back` (elemento de toque-pra-fechar, dentro do app-camada, só ativo quando menu aberto).
   - `AppSidebar` virou componente só de conteúdo (não gerencia mais seu próprio drawer/overlay).

5. **Tema claro/escuro** — porte de `agenda-` (`mob.tema`/`mobSetTema`, toggle manual salvo em localStorage, nunca segue o sistema):
   - `src/lib/theme.ts` — `getStoredTema`/`setStoredTema`/`TEMA_ANTI_FLASH_SCRIPT` (script inline no `<head>`, ANTES do primeiro paint, pra não piscar claro→escuro).
   - `src/routes/__root.tsx` — injeta o script anti-flash, `<html suppressHydrationWarning>` (padrão React correto pra esse caso, não é gambiarra).
   - **Decisão importante de escopo**: só as classes `.kronia-*` (Home/Conversa/menu/toggle) usam os tokens `--kr-*` de `src/styles.css`. As telas antigas (Criar/Histórico/Explorar/Prompt — `.app`/`.card`/`.btn-primary`/etc., ~60+ ocorrências de hex hardcoded) foram **revertidas pra hex fixo**, sem tocar o toggle — porque forçar um tema global único quebraria uma das duas pontas (mockup quer Home clara por padrão vs. telas antigas assumem escuro em dezenas de lugares não convertidos). Isso foi autocorrigido ANTES de subir o bug, não depois.
   - Cores do tema claro = as do mockup real que o usuário mandou (paleta em `:root` no topo de `styles.css`, prefixo `--kr-`).

## Bug real reportado pelo usuário — AINDA NÃO RESOLVIDO

**"Menu não funciona"** no iPhone real do usuário, mas:
- Funciona no navegador normal (Safari comum).
- Quebra/"desconfigura" quando aberto como PWA instalado (ícone na tela de início).
- Screenshot mostrou **3-4 ícones KRONIA diferentes instalados** na tela do usuário (de builds/pontos diferentes do desenvolvimento) — um deles circulado em vermelho como o que ele testa.

O que já foi checado e NÃO explica o bug sozinho:
- Deploy Vercel confirmado atualizado (`39e3af8`, `READY`, produção) via MCP Vercel.
- Teste real de touch-tap (não só click) via Playwright com emulação iPhone 13 — **funcionou** localmente, não reproduziu o bug.
- Não existe service worker no código (descartado como causa direta de cache agressivo por SW).
- Não consegui acessar a URL `*.vercel.app` real de dentro do sandbox (proxy de rede bloqueia hosts não permitidos) — nunca testei a PRODUÇÃO real, só local.

**Hipótese líder, não confirmada**: ícone de PWA instalado tem fundo transparente (`favicon.png` original — confirmado nesta sessão via inspeção de pixel, cantos com alpha 0) e isso faz o iOS renderizar/cachear o ícone de forma inconsistente entre instalações diferentes — plausível explicação pro usuário ver vários ícones "diferentes" na tela mesmo sendo o mesmo app. A correção do `favicon-preto.png` (pendente de commit, ver seção acima) ataca ESSA causa específica, mas:
- Não foi testada/confirmada ainda.
- Mesmo se corrigir o ícone, um PWA **já instalado** com o manifest antigo em cache não vai atualizar sozinho — o usuário provavelmente vai precisar **apagar o ícone antigo da tela e adicionar de novo** ("Adicionar à Tela de Início") depois do deploy da correção, pra pegar o manifest/ícone novos.
- **Ainda não perguntei ao usuário qual dos ícones da tela dele é o que ele realmente testa**, nem sugeri apagar e reinstalar — próximo passo natural depois de confirmar o fix do ícone.

## Última instrução do usuário antes de cortar a sessão

"Deixe com fundo preto" — resolvida (nesta sessão nova, se for a mesma) como a correção do ícone acima. Se a sessão nova não é a mesma que fez essa edição, essa instrução ainda está PENDENTE de execução.

## Pendências pra próxima sessão, em ordem

1. Rodar `npx tsc --noEmit` e `npm run build` nas mudanças do ícone (favicon-preto.png / manifest.json / __root.tsx) — se ainda não commitadas, ver `git status` primeiro.
2. Commitar e dar push (branch `main`, é o padrão que o usuário usa neste repo).
3. Confirmar com o usuário se resolveu o "fundo preto".
4. Voltar ao bug do menu no PWA: perguntar (em texto direto, não `AskUserQuestion` — usuário já recusou essa ferramenta 2x nesse assunto) qual ícone instalado ele testa, e sugerir apagar+reinstalar o PWA depois do deploy da correção do ícone, pra ver se resolve.
5. Se não resolver, investigar mais a fundo: manifest cache-control headers, possível Service Worker sendo registrado por alguma lib de terceiro (não achei nenhum explícito no código, mas não foi um grep exaustivo de `node_modules`), ou comportamento específico de standalone-mode do iOS com o gesto de toque/scroll na sidebar.

## Outro plano em aberto (não é bug, é feature nova — menor prioridade que o bug acima)

Existe um plano salvo (`/root/.claude/plans/humming-wiggling-pine.md` na sessão antiga, pode não existir mais nesta) pra uma camada nova de "Creative Intelligence" (Creative Spec → Target Resolver → Prompt Compiler → QC → Repair) pra gerar prompts de imagem/vídeo profissionais (Veo/Flow/Kling) a partir de produto/ideia. Ainda não iniciado. Só mexer nisso se o usuário pedir explicitamente — não é a prioridade atual (bug real > feature nova).
