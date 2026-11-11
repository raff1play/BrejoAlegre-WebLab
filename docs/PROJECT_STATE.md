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
