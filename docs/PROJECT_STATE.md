# Estado factual — Brejo Alegre Web Lab
> **Estado atual 13/11/2026 (CORE-015, branch `preview`):** malha viária **real** de Brejo Alegre (OpenStreetMap, ODbL) em escala 1:1. Lotes e casas estimados; lojas e galpão fictícios em quadras reais. Todos os sistemas da CORE-014 preservados. Comparação cartográfica em `docs/evidence/core015-mapa/`. Detalhes na seção "CORE-015" ao fim. Nada publicado; sem merge na `main`.

> **Estado atual 13/11/2026 (CORE-014, branch `preview`):** simulador de entregas jogável — câmera única em 3ª pessoa, HUD mínimo com Pausa/Sobre, cidade com 2,15× a área navegável, 48 endereços, 8 lojas com horário/funcionário/clientes, galpão com equipe operando, jornada completa 11h–21h. Detalhes na seção "CORE-014" ao fim. Nada publicado; sem merge na `main`.
> **Estado atual 13/11/2026 (CORE-013, branch `preview`):** cidade ampliada como releitura fictícia de Brejo Alegre, com tráfego, pedestres, semáforos, minimapa, relógio virtual (1 h = 4 min; jornada 11h–21h) e ciclo dia/noite. Detalhes, testes e pendências na seção "CORE-013" ao fim deste arquivo. Nada publicado; sem merge na `main`.
> **Estado atual 12/11/2026:** únicas branches no GitHub: `main` e `preview` (CORE-012 integral). PR #6 de consolidação em rascunho; commits unitários e código real preservados, sem Easter egg. As seções antigas abaixo são registros históricos, não instruções vigentes. Seguir `docs/WORKFLOW.md`.

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

Capturas reais do Babylon.js (não são imagens de IA): `docs/evidence/01-…08-*.jpg`, geradas por `tests/e2e/play.cjs` no build de staging. **Correção 12/11/2026:** o log `e2e-staging-0.1.0.log` citado aqui ficou fora do Git por causa de `*.log` no `.gitignore`; desde a W009 os logs de `docs/evidence/` são versionados.

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

## Publicação W008 — direção mais ágil (11/11/2026)

- GitHub Pages: workflow de preview [43118602693](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43118602693) terminou **success**.
- SHA do build publicado: `cd003b1fabb4d6f7df3612e2702b8b50b1cd8eba` (branch `setup/weblab-foundation`).
- Runner: `npm ci`, validação de repositório, **44/44 testes unitários**, `build:staging` + TypeScript e deploy do Pages concluídos sem erros.
- Endereço de preview declarado pelo GitHub: https://raff1play.github.io/BrejoAlegre-WebLab/
- Teste subjetivo no Galaxy S24 **pendente**: avaliar manobras a baixa/média velocidade, joystick parcial, retorno ao centro, colisões e FPS. CI passou, mas não equivale a dirigibilidade validada no dispositivo.
- `main` permanece sem merge; PR #1 continua em rascunho.

## W009 — Qualidade visual (12/11/2026)

**Branch** `setup/weblab-foundation`, PR #1 em rascunho, `main` sem merge. **Não houve publicação no Pages** nesta etapa (o workflow de preview não foi acionado); o endereço publicado continua com o build da W008 até nova publicação autorizada.

| Commit | Conteúdo |
|---|---|
| `3ca7f574e6918e52aa41c7c37ffdeb79e5f04d2f` | Entrega A — moto e entregador |
| `440f192228a6d66e4e58e0fad4b75cd2ba04ccff` | Entrega B — vitrine urbana + skinning rígido |
| commit de documentação seguinte | este registro |

### Implementado

- **Moto (A):** rodas de cinco raios com pneu, sulcos, aro e disco/tambor; garfo telescópico; farol com aro; painel; guidão com manoplas, manetes e espelhos; motor monocilíndrico com aletas; escapamento cromado com protetor; tanque com faixa; banco; amortecedores com molas; setas; placa em branco (sem registro real); bagageiro e baú com cantos arredondados e refletivos. Animação visual: rodas, esterço, suspensão (mergulho ao frear, agachamento ao acelerar, mola ao subir o meio-fio), inclinação de descanso e com o pé no chão.
- **Entregador (A):** corpo articulado com capacete fechado, viseira, jaqueta com refletivos, luvas e botas; posicionado por IK de dois ossos (`src/core/ik.ts`): mãos nas manoplas acompanhando o guidão, pés nas pedaleiras, pé esquerdo no chão parado, tronco reage à aceleração e às curvas; caminhada guiada pela distância percorrida (sem patinar); transições visuais de descer e montar (perna passa sobre o banco). A simulação continua idêntica: estado de `core/` não é alterado pelas animações.
- **Vitrine (B), cinco fachadas:** varandas com pilares revestidos de pedra canjiquinha, piso vermelho e laje; cobogós; venezianas; arandela; parabólica; postes de portão em pedra; canteiros com arbustos, palmeiras e vasos (instanciados, com colisores); calçada própria por lote (ladrilho hidráulico, pedra portuguesa, intertravado, faixa de grama).
- **Rua toda (B):** cumeeiras e espigões, testeira, molduras de janela, padrão de energia, sarjeta, bocas de lobo, canteiros das árvores, tampa de inspeção, manchas de óleo, sombras de contato na base de muros e casas, sol um pouco mais baixo para sombras mais longas.
- **Desempenho:** skinning rígido na GPU para moto e entregador (uma malha por material), luzes num único material sem iluminação, moto decorativa fundida por material, quatro pisos de calçada num único atlas, perfil leve sem sombra das plantas.

### Testado (Chromium headless com GPU por software, nesta sessão)

| Verificação | Resultado |
|---|---|
| `npm ci`, `validate:repo`, `typecheck`, `build:staging` | aprovados após A e após B |
| `npm run test:unit` | **47/47** (44 existentes + 3 do IK) |
| Roteiro de navegador `tests/e2e/play.cjs` no build de staging | **44/44** após A e **44/44** após B — `docs/evidence/e2e-staging-w009-a.log`, `docs/evidence/e2e-staging-w009-b.log` |
| Capturas reais antes/depois | `docs/evidence/w009-a-moto-entregador-antes-depois.jpg`, `w009-a-animacoes.jpg`, `w009-b-vitrine-antes-depois.jpg`, `w009-b-fachadas-antes-depois.jpg`, `w009-b-perfil-leve-antes-depois.jpg` |

O roteiro de navegador teve uma verificação ajustada: a parada na colisão lateral agora aceita árvore/poste da calçada além do muro (antes falhava conforme o quadro em que a curva terminava) e informa `z`. Depois do último roteiro só mudou a posição de uma mancha de óleo (visual).

### Medidas comparativas (mesmo navegador headless, mesmas vistas; NÃO são FPS de aparelho)

W008 = commit `59e1aa0`, rodado em worktree separado; W009 = HEAD de B. Draw calls por quadro incluem o passe de sombra; triângulos = índices ativos ÷ 3.

| Vista | Perfil | W008 draw calls | W009 draw calls | W008 triângulos | W009 triângulos |
|---|---|---:|---:|---:|---:|
| Vaga inicial | alto | 163 | 156 | 42 mil | 80 mil |
| Vitrine leste | alto | 178 | 183 | 42 mil | 78 mil |
| Vitrine rua | alto | 198 | 201 | 44 mil | 81 mil |
| Vitrine leste | leve | 179 | 180 | 38 mil | 70 mil |
| Vitrine rua | leve | 198 | 198 | 39 mil | 72 mil |

Bundle principal: 1,33 MB (W008) → 1,38 MB (≈ 344 kB gzip). FPS no headless (4–10) usa GPU por software e não serve como medida.

### NÃO testado

- Galaxy S24 / Chrome Android real: aparência, FPS, aquecimento e skinning na GPU do aparelho — **NÃO TESTADO**.
- Chrome desktop com GPU real — **NÃO TESTADO**.
- Avaliação humana da nova aparência — **pendente**.


## Separação da linha principal W009 e do Easter egg — 12/11/2026

**Decisão expressa do usuário:** continuar o projeto pelo simulador W009; o dragão/Easter egg W010, W011 e W012 foi somente um teste e não será mais usado.

- **Branch limpa de continuidade:** `feat/weblab-core-w009`, a partir de `bc453402c928816512d7ebaddc6d066bf24e126c` (último commit W009, imediatamente anterior a W010). **PR #2**: https://github.com/raff1play/BrejoAlegre-WebLab/pull/2 — em rascunho, sem merge.
- **Experimentação preservada e arquivada:** branch `setup/weblab-foundation`, PR #1 encerrado sem merge. W010–W012 só existem nesse histórico experimental; **não os incorporar à linha principal**.
- **Separação conferida:** no commit W009 `src/main.ts` não há import do dragão; `package.json` não possui `@babylonjs/loaders`; não existe o diretório `src/features/easterEgg` nem `src/core/dragonSurprise.ts`.
- **Evidências pré-existentes W009:** 47/47 testes unitários e 44/44 verificações do navegador Chromium headless, capturas/logs em `docs/evidence/w009-*` e `docs/evidence/e2e-staging-w009-b.log`; CI success de `bc453402` run `43135252554`. Android real e desempenho continuam sem comprovação.
- **Publicação:** W009 esteve no Pages, mas o último deploy confirmado do Pages foi o experimento W012 (`4c44f2b`, run `43144700338`). **Nenhum deploy desta branch limpa foi executado.** A URL padrão desabilita a aparição do dragão, mas ainda hospeda o código opcional W012.
- **Governança:** `main` permanece no commit inicial, sem merge. Nada foi apagado do repositório. Qualquer novo deploy da branch limpa exige autorização e revisão do workflow de preview, que continua restrito à branch antiga.

**Próxima etapa:** validação física da W009 no Galaxy S24 (controles, direção, personagem, cenário, FPS, aquecimento) e melhorias focadas no jogo; não voltar ao Easter egg sem novo pedido explícito. O produto definitivo Godot permanece projeto futuro.

## CORE-010 — Remasterização visual da vitrine (12/11/2026)

**Branch** `feat/core-010-visual-remaster` (base `feat/weblab-core-w009` @ `1c90232`); PR em rascunho contra `feat/weblab-core-w009`. Sem merge, sem deploy. W010–W012 não incorporados.

| Commit | Conteúdo |
|---|---|
| `9348f2b` | luz, céu, grading, fundo (morros/casario) |
| `2c06011` | folhagem por cartões, telhados, muros, mobiliário, asfalto, teste |
| `6c2ffe8` | libré amarela/preta da moto e colete do entregador |

**Assets externos:** nenhum (fontes bloqueadas pela rede — ver B032). Tudo procedural, em `src/world/`.

### Testado (Chromium headless, GPU por software)

- `validate:repo` ok; `test:unit` **48/48**; `typecheck` ok; `build:staging` ok (bundle principal 1,377 → 1,388 MB; `dist/` ≈ 2,0 MB).
- Roteiro de navegador no build de staging: **44/44** (pilotar, frear, colisão, descer/andar/montar, câmera, toque emulado) — `docs/evidence/e2e-staging-core010.log`.
- Capturas reais antes/depois nos mesmos enquadramentos: `docs/evidence/core010-vitrine-antes-depois.jpg`, `core010-fachadas-antes-depois.jpg`, `core010-moto-entregador-antes-depois.jpg`, `core010-perfil-leve-antes-depois.jpg`, `core010-horizonte.jpg`.

### Métricas (mesmo navegador e vistas; não são FPS de aparelho)

| Vista | Perfil | W009 draw calls / triângulos | CORE-010 draw calls / triângulos |
|---|---|---|---|
| Vitrine leste | alto | 183 / 78 mil | 199 / 92 mil |
| Vitrine rua | alto | 201 / 81 mil | 217 / 93 mil |
| Vaga inicial | alto | 156 / 80 mil | 168 / 90 mil |
| Vitrine leste | leve | 180 / 70 mil | 193 / 85 mil |

FPS do headless (5–7) não representa hardware. **Galaxy S24 / Chrome Android: NÃO TESTADO.**

## Tentativa de publicação CORE-010 — 12/11/2026

- Autorização explícita do usuário: auditar a CORE-010 e, se tecnicamente adequada, publicar **somente o Preview**, sem merge.
- Workflow `.github/workflows/preview.yml` ajustado na branch `feat/core-010-visual-remaster` para disparar apenas nela (não usa a branch experimental W010–W012). Commit `14104b790eaee3c654e3739c324282520000f5d4`.
- CI do commit `14104b7`: **SUCCESS**, run `43200129501`.
- Preview run `43200129542`: **FAILURE antes de iniciar o runner** (job sem etapas e `runner_id=0`). Nenhum deploy efetuado nesta tentativa; logs não disponíveis no conector (404). A suspeita técnica é a regra de branches permitidas do ambiente `github-pages`, mas o motivo não foi confirmado pelo log.
- Ação necessária: revisar no GitHub Settings → Environments → github-pages as regras de `Deployment branches and tags` para autorizar `feat/core-010-visual-remaster` sem liberar a branch experimental; depois reexecutar o workflow de Preview.
- Não declarar o Pages atualizado antes de execução `success` e confirmação da URL. `main` e PR #3 não foram mesclados.

## CORE-011 — Assets 3D reais (12/11/2026)

**Branch** `feat/core-011-real-assets` (base `feat/core-010-visual-remaster` @ `6cf7e79`); PR em rascunho contra a CORE-010. Sem merge, sem deploy, gatilhos do Pages intocados.

| Commit | Conteúdo |
|---|---|
| `8b255ea` | assets Poly Haven (CC0) otimizados |
| `53494ed` | carregamento glTF, integração, fallback, testes |

**Rede verificada nesta sessão:** download real de `dl.polyhaven.org` (MD5 conferido). Bloqueios: ver B036.

**Integrado e visto no jogo** (capturas `docs/evidence/core011-*.jpg`): 4 postes de ferro ornamentados, 12 caixas de floreira, porta de enrolar da mercearia (25 instâncias) e telha cerâmica fotográfica em todos os telhados. Estado em runtime exposto em `window.__weblab.snapshot().externalAssets`.

**Testes:** `validate:repo` ok; `test:unit` **51/51**; `typecheck` ok; `build:staging` ok (bundle inicial 1,388 → 1,403 MB; `dist/` 2,0 → 3,9 MB por chunks sob demanda); navegador **44/44** (`docs/evidence/e2e-staging-core011.log`).

**Métricas (headless, mesmas vistas):** ver R-PERF-005. Carga local (perfil leve): jogável em ≈ 3,1 s nos dois; modelos externos prontos ≈ 0,2 s depois. **Galaxy S24: NÃO TESTADO.**

## CORE-012 — Câmera GTA opcional (12/11/2026)

- **Branch:** `feat/core-012-gta-camera`, originada de `feat/core-011-real-assets` @ `261e7fba` (versão de Preview já aprovada). Base possui os assets CC0 integrados; não houve merge na `main`.
- **Implementado:** botão GTA/ISO e tecla C; câmera terceira pessoa acompanha a moto, permite giro livre com recentragem após 2,5 s, ajusta distância ao descer/montar e usa volumes estáticos para não atravessar muros/casas/troncos/postes; vista isométrica original e seu zoom/ângulo são preservados.
- **Código:** `src/features/camera/isometricCamera.ts`, `src/core/cameraFollow.ts`, `src/world/cameraObstacles.ts`, `src/features/controls/input.ts`, `src/features/hud/hud.ts`, `src/main.ts`, `index.html`, `src/style.css`.
- **Testes:** `tests/cameraFollow.test.ts` cobre yaw, wrap angular, colisão de câmera e obstáculos. `tests/e2e/play.cjs` ampliado com alternância desktop e touch (não executado no CI: Playwright externo). O CI da branch verifica `validate:repo`, testes unitários, `typecheck` e `build:staging`; consultar o run mais recente para resultado.
- **Não testado:** browser real com GPU, Chrome Android Galaxy S24, capturas e FPS. Não alegar qualidade/comportamento validados no telefone.
- **Publicação:** nenhuma desta branch. Workflow Pages herdado continua limitado à CORE-011, portanto não publica CORE-012 por acidente. Esperar revisão e autorização do usuário para testar no link.

## Reorganização de branches — 12/11/2026

**Decisão explícita do usuário:** parar de criar uma nova branch/PR a cada mudança e utilizar `preview` para desenvolvimento contínuo e `main` para versão estável revisada.

- Branch permanente `preview` criada a partir do commit publicado CORE-012 `bf8881e514e7f6e6a451a299de262197ef1e1271`.
- A árvore dessa origem foi examinada: 163 entradas; não havia arquivos cujo caminho contivesse `dragon`, `easter` ou `surprise`. Easter egg W010–W012 segue na antiga branch experimental, que não foi mesclada.
- CI ajustada para executar também em `preview`. Workflow de Preview limitado à branch `preview` e ao arquivo `docs/PREVIEW_DEPLOY_TRIGGER.md`; commits ordinários **não acionam publicação**.
- `main` continua no commit inicial `2c55f700b7b9e195068a354699607d15381a245d` enquanto ocorre revisão de consolidação. PRs #2–#5 foram encerrados administrativamente **sem merge**, com comentários e indicação do PR consolidado **#6** (em rascunho). Os commits dessas etapas permanecem na ancestralidade da `preview`.
- Antes da migração: CORE-012 teve sucesso na CI (run `43227259084`) e em publicação (run `43227258786`), mas o comportamento de câmera no Galaxy S24 e FPS real permanecem sem teste documentado.
- **Pendência manual:** autorizar `preview` em Settings → Environments → `github-pages` uma única vez. Até lá, não disparar um novo preview e não afirmar que o Pages já aponta para `preview`.
- Ver procedimentos e decisões em `docs/WORKFLOW.md`.
- A CI da `preview` após a documentação inicial foi concluída com **success** (run `43336452746`), com validação, testes e build staging. O PR #6 terá suas próprias verificações antes do merge.

## Exclusão das branches legadas — 12/11/2026

- **Pedido do usuário:** manter só `main` e `preview`, com a última versão CORE-012 na `preview`.
- Antes da limpeza, a comparação `feat/weblab-core-w009`, `feat/core-010-visual-remaster`, `feat/core-011-real-assets` e `feat/core-012-gta-camera` contra `preview` retornou `behind_by=0`, confirmando todos os commits na ancestralidade da `preview`.
- A branch experimental `setup/weblab-foundation` divergiu da `preview` (experimento W010–W012); foi eliminada com aprovação do usuário, sem merge. PR #1 permaneceu fechado.
- Workflow temporário GitHub Actions `43338515888` concluiu com **success** removendo as cinco branches. API GitHub confirmou que restaram apenas `main` e `preview`. O workflow de limpeza foi removido após a execução; nenhuma rotina de exclusão permanece ativa.
- A última versão jogável CORE-012 é ancestral da `preview`. As alterações desde CORE-012 foram documentais e de CI, sem modificar código de jogo.
- A `main` permanece sem merge; PR consolidado #6 ainda precisa de aprovação explícita. **Nenhuma nova publicação no Pages foi solicitada nesta limpeza.**


## CORE-013 — expansão e cidade viva (13/11/2026)

| Item | Situação | Evidência |
|---|---|---|
| Rede viária única (16 nós, 20 vias, 3 semáforos, PARE, esquinas livres) | IMPLEMENTADO e TESTADO (unitário) | `tests/cityPlan.test.ts`, `tests/traffic.test.ts` |
| Semáforos: sem verdes conflitantes, amarelo, vermelho geral, fase de pedestre | TESTADO (unitário) e visto no navegador | `tests/traffic.test.ts` |
| Veículos (carro, moto, bicicleta, van, caminhão, ônibus) sem colisões e sem travamento em 5 min simulados; ônibus param nos pontos, vans em lojas/docas, caminhões nas docas | TESTADO (simulação determinística) | `tests/traffic.test.ts` |
| Frenagem diante do jogador; parada obrigatória no PARE; espera por pedestre na faixa | TESTADO (simulação) | idem |
| Pedestres: rede conectada, travessia só no "siga" do semáforo, lojas, praça, ponto de ônibus | TESTADO (simulação) | `tests/pedestrians.test.ts` |
| Relógio 1 h = 240 s, jornada 11–21, controle de hora sem mudar a escala; luz contínua | TESTADO (unitário) | `tests/clock.test.ts` |
| Minimapa (desenhado da rede), ampliar com toque/M, não cobre analógico/acelerar/câmera | TESTADO no navegador (Chromium headless) | `tests/e2e/play.cjs` |
| Regressão CORE-012 (moto, caminhada, câmeras GTA/ISO, toque, HUD) + verificações da cidade viva | TESTADO: **59/59** no Chromium headless (dev) | `docs/evidence/e2e-core013.log`, `core013-*.jpg` |
| Unitários | TESTADO: **73/73** | `npm run test:unit` |
| FPS no Android | **NÃO MEDIDO** (headless/swiftshader: 4–5 FPS desktop, ~3 FPS celular emulado — não serve de medida) | — |

- **Auditoria pré-publicação (13/11/2026):** ajustados volumes de colisão visual da câmera GTA para a cidade expandida, inclusive altura do galpão, árvores e postes novos (`src/world/cameraObstacles.ts`). Teste unitário de regressão incluído em `tests/cameraFollow.test.ts`; conferir CI da HEAD. Imagens e 59/59 verificações de navegador são da versão anterior à correção pontual: não alegar que o E2E foi repetido após o ajuste. Sem resultado FPS real no Galaxy S24.

## CORE-014 — simulador de entregas (13/11/2026)

| Item | Situação | Evidência |
|---|---|---|
| Câmera única em 3ª pessoa (GTA/ISO removido), sobe sobre obstáculos, interiores | TESTADO no navegador | `docs/evidence/e2e-core014.log`, `core014-09-*.jpg` |
| HUD mínimo; aviso fictício na Pausa/Sobre; pausa congela o relógio | TESTADO no navegador | `core014-10-*.jpg` |
| Área navegável 17.820 → 38.296 m² (+ interiores) | TESTADO (unitário) | `tests/delivery.test.ts` |
| 48 endereços únicos, porta livre na calçada, vaga na rua, na rede de pedestres; números iguais nas placas | TESTADO (unitário) | idem |
| 8 lojas: horários, porta de enrolar, funcionário exclusivo, fila de clientes atendida no balcão | TESTADO (unitário) + visto no navegador | `core014-depois-loja-interior.jpg` |
| Galpão: 8 funcionários com papel e turno; conferência, triagem e saca sem duplicar volumes | TESTADO (unitário e navegador) | `core014-12-*.jpg` |
| Jornada completa loja → galpão → saca → residência (8/8) | TESTADO no navegador (posicionamento por ferramenta de depuração; ações reais) | `core014-11/13-*.jpg` |
| Regressão: pilotagem, caminhada, colisão, câmera, toque, tráfego, minimapa, dia/noite | TESTADO: **70/70** no Chromium headless | log |
| Unitários | TESTADO: **79/79** | `npm run test:unit` |
| Qualidade visual vs. CORE-012 | AVALIAÇÃO HUMANA PENDENTE | `docs/VISUAL_AUDIT_CORE014.md` |
| FPS no Android | **NÃO MEDIDO** (headless: ~3 FPS por GPU de software, não é medida) | — |

- **Integração (13/11/2026):** os commits da CORE-014 foram rebaseados sobre a correção de câmera e o deploy aprovado da CORE-013 (`e1cfd7b`). Conflito em `src/world/cameraObstacles.ts` resolvido mantendo os volumes da CORE-013, exceto o bloco sólido do galpão e o mobiliário interno (o galpão e as lojas agora são acessíveis; paredes e tetos entram por `cityCameraObstacles()`). Após o rebase: 80/80 unitários e **70/70** no navegador (`docs/evidence/e2e-core014.log`). A CORE-014 **não foi publicada**: `docs/PREVIEW_DEPLOY_TRIGGER.md` não foi alterado.

## Experimento Patch.gg removido (CORE-015, 13/11/2026)

- Por pedido do usuário, o piloto opcional Patch.gg (`?assets=patch`: ônibus GLB Polyfork e pedestre animada anymove, commits `22e33f0`…`0511045`) foi **revertido seletivamente** para o estado da CORE-014 (`8a18fc2`): GLBs, licenças/créditos, `patchPilot.ts`, testes e evidências exclusivos removidos; `cityLife.ts`, `main.ts`, `externalAssets.ts`, `index.html` e documentação restaurados. Histórico preservado (sem reset/force push). Assets Poly Haven da CORE-011 mantidos. `docs/PREVIEW_DEPLOY_TRIGGER.md` não alterado.

## CORE-015 — Brejo Alegre real em escala 1:1 (13/11/2026)

**Situação:** a malha fictícia da CORE-014 foi substituída pela malha viária **real** do OpenStreetMap (1 unidade = 1 m), com todos os sistemas da CORE-014 funcionando sobre ela. Trabalho direto na `preview`; nada publicado (`docs/PREVIEW_DEPLOY_TRIGGER.md` intocado), sem PR e sem merge na `main`.

| Item | Situação | Evidência |
|---|---|---|
| Dados OSM do recorte da sede (126 kB, ODbL, procedência) | OBTIDO via GitHub Actions (proxy da sessão bloqueia Overpass/IBGE) | `data/osm/SOURCE.json`, commit `45cdb4c` |
| Conteúdo validado: 144 vias (126 carroçáveis), 33 nomes, 159 cruzamentos (86 na sede), **7 edificações** | TESTADO | `docs/evidence/core015-mapa/metricas.json` |
| Malha do jogo = OSM: 100 % dos eixos carroçáveis cobertos e 100 % das vias do jogo sobre o OSM (tol. 1 m), 87/87 cruzamentos, erro de escala ≤ 0,03 m | TESTADO (script independente) | `docs/evidence/core015-mapa/` |
| Escala 1:1 contra haversine, nomes, conectividade, cruzamentos por nó compartilhado, cobertura, lotes fora das ruas, alcance a pé | TESTADO (unitário) | `tests/geo.test.ts` |
| 46 quadras, 688 lotes (674 casas **estimadas**), 8 lojas e galpão **fictícios** em quadras reais, 48 endereços em ruas reais | TESTADO | `tests/geo.test.ts`, `tests/delivery.test.ts` |
| Tráfego na malha real (mão única na pista dupla, admissão encadeada, PARE por prioridade, sem semáforo inventado) | TESTADO (simulação sem colisão nem travamento) | `tests/traffic.test.ts` |
| Pedestres: calçadas conexas, travessia só com a via livre, lojas e praças reais | TESTADO | `tests/pedestrians.test.ts` |
| Jornada completa (coleta → galpão → triagem → saca → 8 entregas), câmera, minimapa, toque, pausa | TESTADO no Chromium headless: **70/70** | `docs/evidence/core015-e2e/` |
| Casas por setor (100 m) com LOD distante e detalhe perto (150 m desktop / 95 m celular) | IMPLEMENTADO; medido em headless | ver medidas abaixo |
| FPS em Android | **NÃO MEDIDO** | — |

**Medidas em headless (SwiftShader; não representam aparelho):**
- carga em ~3–5 s em desenvolvimento;
- 59 setores de casas, com 6–16 detalhados conforme o lugar;
- no centro: 715 malhas ativas e ~486 mil triângulos no perfil celular, 888 malhas e ~730 mil triângulos no desktop;
- bundle principal de 1,61 MB (422 kB gzip), antes 1,32 MB.

Unitários: **82/82**. `validate:repo`, `typecheck` e `build:staging` passam.

**Commits:**
- `1ddbd18`: reversão do Patch;
- `b80d5c0`, `c62a6dd`, `bc8a15f`: download OSM e workflow;
- `45cdb4c`: dados;
- `05ebccb`: importador;
- `c0c3ccd`: base geométrica;
- `99d1fca`: cidade real;
- `15b2369`: testes;
- `2c21498`: galpão/entregas em coordenadas reais e e2e;
- o commit seguinte traz a comparação cartográfica e a documentação.

**Pendências:**
- FPS e termal em Android real;
- avaliação visual humana;
- decidir o texto do aviso "NÃO REPRESENTA BREJO ALEGRE" (C13-06);
- locais não confirmados no OSM (ver `docs/CITY_REFERENCE.md`);
- relevo;
- calçadas em vias rurais.

## CORE-015.1 — Correções visuais, colisões, baú, HUD e controles (14/11/2026)

**Situação:** correções sobre a CORE-015 publicada, direto na `preview`, em cinco commits. **Não publicado**: `docs/PREVIEW_DEPLOY_TRIGGER.md` intocado; sem PR; `main` intocada.

| Item | Situação | Evidência |
|---|---|---|
| Meio-fio e muros fora do asfalto (curvas, ruas sem saída, triângulos de cruzamento) | TESTADO: 1 de 16 402 amostras de meio-fio a menos de 3,7 m do eixo (antes 357); 0 muros a menos de 6 m de um eixo (antes 24) | `tests/geo.test.ts`, `comparacao-muro-rua-sem-saida.jpg` |
| Casas com a planta do tamanho do lote real (antes 12 × 20 m fixos em lotes de 10–17,6 × 12–20 m) | TESTADO | `tests/geo.test.ts`, `comparacao-casas-q24.jpg` |
| Asfalto sem cintilação em sobreposições; calçada alinhada à rua; sem segunda camada de grama | IMPLEMENTADO; conferido nas capturas (não há teste automático de cintilação) | `comparacao-esquina.jpg` |
| Deslize ao longo de paredes em qualquer ângulo; postes, luminárias e floreiras sólidos | TESTADO | `tests/collision.test.ts` |
| Oito lojas: entrar, balcão, sair; planta única para modelo e colisor; moto não entra; porta fechada é sólida | TESTADO | `tests/storeLayout.test.ts`, `comparacao-loja-*.jpg` |
| Encomendas físicas: loja → mãos → baú → galpão → saca → baú → mãos → destinatário | TESTADO (unitário auditado a cada passo + navegador) | `tests/delivery.test.ts`, `e2e/14-…`, `e2e/15-…` |
| HUD (carga, distância, relógio, botão contextual) em 780 × 360 e desktop | TESTADO em viewport emulado | `depois-hud-celular-*.jpg` |
| Minimapa: contraste, edificações, rota pelas ruas, paradas, moto, mapa ampliado com nomes e escala | TESTADO | `tests/streetRoute.test.ts`, `e2e/16-…` |
| Esterço sensível à velocidade, rampa de acelerador e freio | TESTADO (unitário); **sensação no aparelho não avaliada** | `tests/simulation.test.ts` |
| FPS em Android | **NÃO MEDIDO** | — |

Unitários: **94/94**. Navegador: **84/84**. `validate:repo`, `typecheck`, `build:staging` passam. Bundle principal: 1,63 MB (431 kB gzip), antes 1,61 MB.

Números atuais do mapa: 46 quadras, 695 lotes, 681 casas estimadas, 48 endereços; cobertura OSM inalterada (100 %/100 %, 87/87 cruzamentos).

**Commits:** `9a319bc` (calçadas, muros, colisões externas), `e970d67` (lojas), `accb962` (baú), `85db0ea` (HUD, minimapa, controles) e o commit de documentação seguinte.

**Problemas que continuam:**
- FPS, temperatura e ergonomia em Android real não medidos; a sensação do novo esterço precisa de teste humano.
- No triângulo de cruzamentos perto de (−410, 9) as placas da calçada ainda se sobrepõem um pouco.
- Clientes das lojas andam em linha reta e podem atravessar um expositor.
- A câmera pode ficar do lado de fora da loja enquanto a porta de enrolar sobe.
- O galpão foi deslocado ~45 m na mesma via, para não cobrir uma rua sem saída.
- O aviso "NÃO REPRESENTA BREJO ALEGRE" continua pendente de decisão (C13-06).

## 14/11/2026 — correções isoladas da Street Preview

- Pedido explícito: corrigir faixas, sobreposições e objetos diante das lojas exclusivamente em `feat/core-015-2-urban-roads-preview`; publicação condicionada aos testes, somente em `/street-preview/`.
- Código e comparação visual: commit `c9f5c0a`; diagnóstico detalhado e capturas reais em [evidence/street-fixes/README.md](evidence/street-fixes/README.md).
- `npm run check`: validação do repositório, **99/99 testes unitários**, TypeScript e build staging aprovados. CI [43553014170](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43553014170) **Success**, SHA `c9f5c0a9e2504f53f587ffc3da703a9f11572cd0`.
- Teste visual `tests/e2e/street.cjs`: loja abre e cruzamento inclinado é capturado, sem erros de página, antes/depois. Indicadores amarelos e postes coloniais preservados.
- Malha OSM, escala 1:1 e CORE-015.1 preservadas. `main` permanece em `2c55f70`; `preview` em `d6eabc4`.
- Chrome Android físico, FPS/temperatura: não testados. Resultado final do roteiro amplo e eventual publicação serão registrados abaixo; push não significa deploy.
- Navegador final: roteiro amplo **83/84** em resolução interna reduzida (única falha: expectativa de tamanho do render, afetada pelo adaptador); repetição desktop sem redução **33/33**, incluindo redimensionamento 900×420. Jornada 8/8 entregas e toque emulado aprovados. Logs completos e condições em `docs/evidence/street-fixes/`.
