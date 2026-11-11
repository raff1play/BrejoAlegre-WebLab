# Estado factual — Brejo Alegre Web Lab

**Atualização:** 11/11/2026, após a implementação da versão 0.1 jogável. Registro datado: confirme sempre a HEAD e a CI atuais no GitHub.

## Repositório, branch e revisão

- Repositório público: https://github.com/raff1play/BrejoAlegre-WebLab
- `main`: commit inicial `2c55f700b7b9e195068a354699607d15381a245d`; **não houve merge**.
- Branch de trabalho: `setup/weblab-foundation`. PR: https://github.com/raff1play/BrejoAlegre-WebLab/pull/1 (rascunho, sem merge, sem deploy).
- Commits da 0.1 nesta branch:
  - `c0795b99c1ee26c3e48cace377962400887173fb` — `package-lock.json` versionado; CI e Pages usam `npm ci`.
  - `37a7d312dc8d57caba2c7fc31765299e5ff72a73` — jogo 0.1: simulação, mundo, câmera, controles, HUD, testes.
  - `f1615d942f7bb579e1e9104a8fd5c0d9c4c2fba1` — roteiro de navegador validado no build de staging + capturas reais.
  - commit de documentação seguinte a este (ver `git log`).

## O que está IMPLEMENTADO e TESTADO (com evidência)

| Item | Situação | Evidência |
|---|---|---|
| `npm ci`, `validate:repo`, `typecheck`, `build:staging` | TESTADO localmente (nuvem) em 11/11/2026 | saída dos comandos; CI abaixo |
| Testes unitários | TESTADO: **25/25** (`npm run test:unit`) | `tests/*.test.ts` |
| Jogo abre no navegador sem erro | TESTADO em Chromium headless (dev e build de staging) | `docs/evidence/e2e-staging-0.1.0.log` |
| Moto acelera, freia, vira, desacelera, dá ré lenta | TESTADO no navegador | idem, capturas 01–02 |
| Moto não atravessa muros/casas nem sai da área | TESTADO (unitário + navegador) | captura 06 |
| Descer só parado, caminhar, voltar e montar | TESTADO no navegador | captura 05 |
| Controle nunca simultâneo de moto e pedestre | TESTADO no navegador | log |
| Câmera segue, gira, aproxima, afasta, arrasto e pinça | TESTADO no navegador | capturas 03–04 |
| Prédio entre câmera e jogador fica translúcido | IMPLEMENTADO; lógica testada em unitário; visto em captura manual, sem verificação automática no navegador | `src/features/camera/occlusionFader.ts` |
| Teclado (WASD/setas, Q/E, Z/X, F) | TESTADO no navegador | log |
| Botões de toque, multitoque, soltar/cancelar sem comando preso | TESTADO com toque **emulado** (protocolo DevTools) em viewport 780×360 | capturas 07–08 |
| HUD em paisagem, botões ≥ 44 px, centro da tela livre | TESTADO em viewport emulado | log |
| Resize e perda de foco | TESTADO no navegador | log |
| Aviso "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE" | TESTADO: HUD + 4 placas 3D na cena | capturas |
| Cena: 10 casas, mercearia genérica, praça, cruzamento, calçadas, meio-fio, muros, portões, árvores, postes, fiação, vagas de moto | IMPLEMENTADO e visível nas capturas; contagens verificadas em `tests/layout.test.ts` | capturas 01–08 |
| Perfis gráficos desktop/mobile | IMPLEMENTADO; seleção automática testada em emulação | `src/config/graphics.ts` |

Capturas reais do Babylon.js (não são imagens de IA): `docs/evidence/01-…08-*.jpg`, geradas por `tests/e2e/play.cjs` no build de staging.

## O que NÃO foi testado

| Item | Situação |
|---|---|
| Chrome em Android real (Galaxy S24 ou outro) | **NÃO TESTADO** — não havia aparelho no ambiente de nuvem |
| FPS em aparelho real, temperatura, bateria | **NÃO MEDIDO**. 30 FPS continua sendo META |
| Chrome desktop com GPU real | **NÃO TESTADO** — só Chromium headless com GPU por software (SwiftShader), que rendeu 4–9 FPS; esse número NÃO representa hardware real |
| Toque real com dedos (ergonomia, alcance dos polegares) | **NÃO TESTADO** — só eventos de toque emulados |
| Safari/iOS, Firefox | NÃO TESTADO |
| GitHub Pages | **NÃO PUBLICADO**; não há URL pública nem preview temporário |

## Medidas reais desta versão (não são FPS de aparelho)

- Bundle principal: **1,32 MB** (≈ 324 kB gzip); antes 7,2 MB (≈ 1,6 MB gzip). `dist/` total ≈ 1,9 MB.
- ≈ 160 draw calls por quadro incluindo o passe de sombra, ≈ 40 mil triângulos (medido em dev no Chromium headless, perfil desktop).
- Nenhum arquivo de asset baixado: texturas pintadas em canvas na inicialização.

## Código que existe

- `src/core/`: regras puras sem Babylon/DOM — `collision.ts` (círculo×caixa, deslizamento com subpassos), `motorcyclePhysics.ts` (modelo cinemático de bicicleta com limite de aderência; **não é física de corpo rígido**), `walking.ts`, `mounting.ts`, `terrain.ts`, `inputState.ts`, `math.ts`.
- `src/world/`: `layout.ts` (planta fictícia pura: lotes, colisores, áreas elevadas, oclusores), `temporaryWorld.ts`, `buildings.ts`, `props.ts`, `environment.ts` (sol, céu, névoa, sombra), `textures.ts` (procedurais), `materials.ts`, `geometry.ts` (fusão de geometria por material).
- `src/features/`: `driving/motorcycle.ts`, `walking/pedestrian.ts`, `camera/isometricCamera.ts` + `occlusionFader.ts`, `controls/input.ts`, `hud/hud.ts`, `shared/modelParts.ts`.
- `src/config/`: `environment.ts`, `graphics.ts`. `src/main.ts`: composição.
- `tests/`: `collision`, `simulation`, `layout` (unitários) e `e2e/play.cjs` (navegador; exige Playwright no ambiente, **não roda na CI**).

## Arte e o que NÃO existe

- Sem modelos 3D externos: moto, piloto, casas e árvores são primitivas fundidas, com texturas procedurais. Visual semirrealista simples, longe das referências de IA (que não estão no repositório).
- Sem mapa real de Brejo Alegre, servidor, multiplayer, login, economia, scanner, coletas, entregas, NPCs, tráfego, áudio ou APK.

## CI

| HEAD | Resultado | Execução |
|---|---|---|
| `c0795b9` (lockfile + `npm ci`) | **success** | https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43030369216 |
| `f1615d9` (jogo 0.1 + evidências) | **success** (push e pull_request) | https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43036567194 e https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43036577279 |

A CI roda `npm ci`, `validate:repo`, `test:unit` e `build:staging` e guarda o `dist/` como artefato. **Não roda o roteiro de navegador.** O commit de documentação posterior dispara nova execução: conferir na aba Actions.

## Próximo agente

Ler `AGENTS.md` e `docs/NEXT_TASK_FOR_FABLE.md` (agora descreve a tarefa seguinte: validação em Android real e ajustes guiados por medição). Não fazer merge nem publicar Pages sem autorização do usuário.

**Terminologia:** IMPLEMENTADO = código presente; TESTADO = comando ou ação reproduzida; NÃO TESTADO = sem execução; BLOQUEADO = tentou e falhou; APROVADO = usuário aceitou com evidência.


## Tentativa de publicar prévia no GitHub Pages — 11/11/2026

- **Autorização explícita do usuário:** solicitou publicar a prévia.
- Criado `.github/workflows/preview.yml` exclusivamente na branch `setup/weblab-foundation` para staging; `main` e workflow de produção preservados.
- Workflow tentativa: https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43038148198 .
- **Resultado: failure na etapa `actions/configure-pages@v5`**: `Get Pages site failed ... repository has Pages enabled and configured to build using GitHub Actions ... Not Found`.
- **Antes da falha passaram:** `npm ci`, `validate:repo`, `test:unit`, `build:staging`.
- **Não houve deploy**; não afirmar URL pública funcionando. O site `https://raff1play.github.io/BrejoAlegre-WebLab/` é somente o endereço esperado.
- **Ação manual necessária:** proprietário abre `https://github.com/raff1play/BrejoAlegre-WebLab/settings/pages` → *Build and deployment* → *Source* = **GitHub Actions**, salvar.
- Quando Pages estiver habilitado, reexecutar o workflow falho (job `130582420706`) e checar sucesso + URL antes de dizer PUBLICADO. A integração GitHub neste chat não possui ação administrativa de ativação do Pages.
- A publicação temporária está aprovada apenas para teste; nenhum merge autorizado para `main`.

## Preview GitHub Pages publicado — atualização 11/11/2026

- Após o usuário habilitar Source = GitHub Actions e liberar a branch do ambiente Pages, a execução `43038890916` (tentativa 2) concluiu **SUCCESS**: dependências, 25 testes, build, configure-pages, upload e deploy.
- Log do GitHub Actions confirmou `Evaluated environment url: https://raff1play.github.io/BrejoAlegre-WebLab/`.
- Versão implantada: commit `a72f14c0946b51c0410c2b38d72f0d7f4ca39398`, branch `setup/weblab-foundation`.
- **Status:** Publicação confirmada pelo GitHub Actions; teste HTTP externo direto neste ambiente indisponível (ferramenta web recusou abrir URL, container sem DNS externo). Ainda falta o usuário abrir pelo Chrome Android para validar carregamento, controles e FPS.
- A `main` não foi alterada; PR #1 continua em rascunho. O workflow está restrito a alterações explícitas em `docs/PREVIEW_DEPLOY_TRIGGER.md` ou `.github/workflows/preview.yml`; novos commits comuns NÃO republicam automaticamente.

## Alteração de orientação horizontal — 11/11/2026

- Implementado um botão **Jogar na horizontal** no aviso de retrato; ao tocar solicita fullscreen e tenta `screen.orientation.lock('landscape')`.
- Em navegadores que não suportam ou recusam as APIs, mantém alternativa de giro manual; não altera as opções de orientação do sistema.
- Testes unitários de caminhos suportados/negados adicionados em `tests/landscape.test.ts`; a CI passou na HEAD de código `1ffd0b8f394ee811d0a0cafd0075fcad61f5f69c`.
- **NÃO TESTADO em Android real**. O usuário deve testar tocando no botão em Chrome Android e relatar se o celular gira automaticamente.
- O Pages só inclui o novo botão depois de nova publicação explícita do workflow de preview. Não equiparar push a deploy.

### Publicação do botão horizontal — 11/11/2026

- A execução de preview `43043876785` terminou **success**, incluindo `npm ci`, testes unitários, `build:staging`, configuração e deploy do Pages. Log do GitHub: `Evaluated environment url: https://raff1play.github.io/BrejoAlegre-WebLab/`.
- Commit efetivamente implantado: `2bbbd14edab115fafadf0c47a028f90d33ecf991`.
- O link publicado é `https://raff1play.github.io/BrejoAlegre-WebLab/`; a ferramenta de consulta web deste chat não conseguiu carregá-lo diretamente, então o carregamento/resultado do botão no Galaxy S24 **continua NÃO TESTADO**.
- Para validar: abrir no Chrome Android em retrato, tocar em **Jogar na horizontal**, verificar tela cheia + rotação; testar saída de tela cheia e fallback manual. Não declarar orientação forçada como garantida.
- Preservados PR #1 em rascunho e `main` sem merge.

## PWA instalável — implementação 11/11/2026

- Pedido explícito do usuário: instalar como aplicativo para evitar o aviso cinza que o Chrome exibe ao entrar em `requestFullscreen()` na aba.
- Adicionados `public/manifest.webmanifest` (modo `standalone`, preferência `landscape`), ícones PNG originais `public/icons/icon-{192,512}.png`, `public/sw.js` e `src/features/display/pwa.ts`.
- Tela vertical e HUD oferecem botão **Instalar app**; `beforeinstallprompt` quando permitido, instruções do menu do Chrome como alternativa. Jogo normal no navegador continua funcional.
- Em modo aplicativo instalado, o botão de orientação **não solicita browser fullscreen**; tenta orientação diretamente com fallback manual.
- Service worker com rede primeiro, fallback de cache e escopo do próprio projeto. Nenhum servidor extra, conta, API key ou custo criado.
- **CI verificada na HEAD `5fda84ea40c7fb967d56e2084f31785421d257f3` (run `43047036838`): success; `npm ci`, validação, **38/38 testes unitários**, typecheck e Vite staging build.** Posteriores commits de docs exigem reconferir a nova HEAD.
- **PENDENTE:** Chrome Android instalar por prompt/menu, lançamento via ícone em paisagem, ausência real do aviso cinza, testes offline, atualizações e tela cheia pós-instalação.
- A publicação de preview é controlada separadamente por `.github/workflows/preview.yml`; build verde não significa novo deploy concluído.

## Publicação PWA — resultado confirmado no GitHub Actions (11/11/2026)

- Preview workflow `43047390148`: **completed / success** (https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43047390148).
- Commit do build implantado: `c749d27d171b782de269e3218bb0f8c5b70947b3`.
- No runner: instalação, validação de repositório, **38/38 testes unitários**, typecheck, build staging, configure-pages, upload e deploy aprovados.
- Log do deploy: `Evaluated environment url: https://raff1play.github.io/BrejoAlegre-WebLab/`.
- O link foi confirmado pelo GitHub Actions, mas uma requisição HTTP independente do ambiente deste chat não pôde ser concluída; **o Chrome Android real ainda precisa comprovar** instalação, janela standalone sem aviso cinza, orientação horizontal e fallback online/offline.
- A `main` permanece intocada e o PR #1 segue em rascunho.

## Mudança W007 — navegador e analógico (11/11/2026)

**Pedido atual:** desativar PWA por enquanto e substituir controles de esquerda/direita por joystick analógico real.

- **Implementado no código:** removidos manifesto e CTA de instalação da interface; inicialização PWA desativada; worker antigo substituído por arquivo de desativação e `src/features/display/disablePwa.ts` para desregistrar somente o escopo do jogo e apagar caches com prefixo exclusivo. Ativos históricos permanecem, sem registro ativo.
- **Implementado no código:** joystick virtual em `src/features/controls/virtualJoystick.ts` e matemática pura em `src/core/analogStick.ts`; steering X proporcional na moto, movimento X/Y em 360° a pé, aceleração/freio à direita, teclado intacto.
- **Testes alterados:** `tests/analogStick.test.ts`, `tests/pwa.test.ts`, `tests/landscape.test.ts`; roteiro `tests/e2e/play.cjs` agora simula steering/caminhada pelo stick.
- **Estado:** até esta edição, CI da HEAD final e deploy final ainda requerem consulta explícita. A última publicação do Pages antes desta mudança ainda contém PWA. Não tratar novo código no GitHub como site atualizado.
- **Android real:** joystick, reset de multi-toque e limpeza do SW precisam de validação manual; PWA instalado anteriormente pode exigir remoção manual do ícone do Android.
- **Governança:** branch `setup/weblab-foundation`, PR #1; `main` sem merge.

## Publicação W007 — navegador e analógico (11/11/2026)

- **Deploy confirmado pelo GitHub Actions:** workflow preview `43050803631` — `completed / success`; commit efetivamente implantado `d3754acec91d7978d1db58fbd9f8b1d72101cc8a`.
- **Validação do mesmo commit:** `npm ci`, validação documental, **41 testes unitários aprovados**, typecheck e `build:staging`. CI pushes `43050803541` e `43050820689` também concluídas `success`.
- URL confirmada no log do deploy: https://raff1play.github.io/BrejoAlegre-WebLab/ .
- O novo build remove botões/manifesto de instalação PWA, migra o touch esquerdo para joystick proporcional, mantém teclado/acelerador/freio, desregistra somente o worker antigo do jogo e limpa somente caches prefixados `brejo-weblab-`.
- **Não comprovado em dispositivo físico:** reação aos gestos do Galaxy S24, conforto, FPS depois da mudança, ausência de controles presos. Os testes unitários não substituem essa avaliação; o teste de navegador emulado após W007 não foi executado automaticamente.
- O usuário que tiver instalado o PWA antigo deve removê-lo manualmente do Android e abrir o endereço no Chrome.
- `main` intocada e PR #1 em rascunho; deploy limitado à branch `setup/weblab-foundation`.

## Ajuste W008 — moto mais leve de manobrar (11/11/2026)

- Relato após testar W007: **direção da moto pesada; dificuldade para manobrar**.
- Corrigida hipótese em dois pontos: comando analógico exigia grande deslocamento do polegar, e a física limitava entrada/raio de curva. Implementada curva de resposta do analógico **apenas para pilotagem** em `src/core/analogStick.ts` e `src/features/controls/input.ts`; modificada a calibração física em `src/core/motorcyclePhysics.ts`.
- Novos testes de resposta/simetria/recentralização em `tests/analogStick.test.ts` e `tests/simulation.test.ts`.
- **Ainda não comprovado:** se a nova dirigibilidade agrada no Galaxy S24; comparar por teste com a versão anterior e ajustar novamente se necessário.
- **Status de CI e deploy:** a ser atualizado após consultar o GitHub Actions e o preview da HEAD publicada; não confundir commits com deploy.

