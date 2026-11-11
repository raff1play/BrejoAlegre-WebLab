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
