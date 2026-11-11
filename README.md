# Brejo Alegre Web Lab — protótipo single-player no navegador

> **Estado: VERSÃO 0.1 JOGÁVEL NA BRANCH `setup/weblab-foundation`, testada em Chromium headless; AINDA NÃO TESTADA EM ANDROID REAL.** Repositório: https://github.com/raff1play/BrejoAlegre-WebLab. PR em rascunho: https://github.com/raff1play/BrejoAlegre-WebLab/pull/1. A `main` não foi alterada e nada foi publicado no Pages.

![Captura real do Babylon.js na rua de teste](docs/evidence/02-pilotando-rua.jpg)

**O que é:** laboratório 3D descartável (Babylon.js 9.35.0 + TypeScript 5.9.3 + Vite 7.3.0), feito para experimentar direção, interações e direção de arte por navegador desktop ou Android. Não é o jogo final em Godot e não existe multiplayer ou backend nesta fase.

**Importante:** O antigo erro 403 da integração GitHub foi resolvido; o registro histórico está em `docs/GITHUB_UPLOAD_BLOCKER.md`. Para começar, leia `docs/PROJECT_STATE.md` e `docs/NEXT_TASK_FOR_FABLE.md`. Não fazer merge/deploy sem aprovação.

**CI remoto (11/11/2026):** [execução #43036567194](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43036567194) passou na HEAD `f1615d9` (`npm ci`, validação, 25 testes, build de staging). O roteiro de navegador (`npm run test:e2e`, 44 verificações) roda fora da CI; resultado e capturas em `docs/evidence/`. **FPS em aparelho real não foi medido.**

**Leia antes de implementar:** [`AGENTS.md`](AGENTS.md) → [`docs/00_START_HERE.md`](docs/00_START_HERE.md) → [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) → [`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md) → [`docs/NEXT_TASK_FOR_FABLE.md`](docs/NEXT_TASK_FOR_FABLE.md). Essas referências foram criadas para outros chats e outras IAs trabalharem sem acesso a memória externa.

## Rodar no computador

É preciso **Node.js >=22.12**, npm e conexão ao registro npm ao menos na primeira instalação.

```sh
npm ci
npm run validate:repo
npm run test:unit
npm run typecheck
npm run dev
```

Abra http://localhost:5173. Para testar no Chrome Android da mesma rede Wi-Fi, abra `http://IP_DO_COMPUTADOR:5173` e autorize a conexão no firewall local. A orientação horizontal é recomendada.

```sh
npm run build:staging       # compilação de pré-validação, sem deploy
npm run build:production    # gera dist/ para publicação, sem deploy
npm run preview             # serve dist/ localmente
```

**Não confundir ambientes com cópias de código:** `src/features/` organiza mecânicas; `.env.development/.env.staging/.env.production` selecionam o modo; `dist/` é criado pelos builds. GitHub Actions só publica Pages após execução manual de workflow na branch `main`, depois de aprovado.

## Controles (testados em Chromium; toque apenas emulado)

| Ação | Desktop | Toque |
|---|---|---|
| Acelerar / andar para a frente | W / ↑ | ▲ |
| Frear (parado: soltar e apertar de novo dá ré lenta) / andar para trás | S / ↓ / Espaço | ▼ |
| Virar / andar para os lados | A/D ou ←/→ | ◀ / ▶ |
| Descer (só parado) / montar (perto da moto) | F ou Enter | Botão Descer/Montar |
| Girar câmera | Q/E ou arrastar na cena | ↶/↷ ou arrastar |
| Zoom | Z/X, +/−, roda do mouse | ＋/－ ou pinça |
| Trocar perfil gráfico | G | botão "Gráficos" |

A pé o movimento é relativo à câmera. `?gfx=mobile` ou `?gfx=desktop` na URL força o perfil gráfico.

## Código e organização

```text
src/
  core/               # matemática e regras puras testáveis
  config/             # perfis dos ambientes (sem segredos)
  features/
    driving/          # modelo da moto (movimento em core/)
    walking/          # personagem a pé
    camera/           # câmera isométrica e fade de oclusão
    controls/         # teclado e toque
    hud/              # textos e avisos na tela
  world/              # mundo temporário sem validade cartográfica
  main.ts             # composição da cena, não lógica de domínio
  style.css           # HUD e responsividade

tests/                # testes determinísticos sem Babylon/browser
tests/e2e/            # roteiro de navegador (Playwright do ambiente, fora da CI)
docs/evidence/        # capturas e log reais do navegador
scripts/              # validação da integridade do repositório
docs/                 # requisitos, decisões, estado e handoff
.github/workflows/    # CI staging; produção manual e protegida
```

## Limites da versão 0.1

- Cena fictícia de rua em primitivas com texturas procedurais, sombras e névoa; moto e personagem simplificados. A moto usa um modelo cinemático e a colisão é círculo contra retângulos; não é física de corpo rígido.
- Ainda faltam modelos de arte licenciados, áudio, avaliação humana da dirigibilidade e testes num Android verdadeiro.
- A meta de 30 FPS em dispositivo intermediário é **alvo**, não número medido.
- As imagens do Runway são referências artísticas, nunca prova de renderização Babylon. **O JPG de referência não foi versionado neste primeiro commit**; solicitar a imagem original quando precisar de uma comparação visual.
- Mapa geograficamente fiel, NPCs logísticos, entrega, inventário, scanner, economia e multiplayer são etapas posteriores.

## Estado de validação

Ver `docs/PROJECT_STATE.md`. Na preparação local o npm registry retornou `EAI_AGAIN`, por isso o `package-lock.json` não pôde ser criado. **A compilação completa passou no runner do GitHub Actions**; o que continua pendente é testar o jogo de fato em Chrome e Android. Na próxima execução de instalação no projeto, **versionar o `package-lock.json` e trocar o CI de `npm install` para `npm ci`**.

## Licenciamento e gastos

Babylon.js e ferramentas abertas não exigem assinatura do motor. Não utilizar assets, marcas oficiais ou dados privados sem licença/consentimento. Não contratar serviços nem publicar sem aprovação. Repositório público **não significa** que todos os arquivos de arte tenham licença aberta; não supor permissões de redistribuição.

## Instalar como aplicativo no Android (PWA)

A versão web pode ser instalada sem APK, sem Play Store e sem assinatura. A instalação **não transforma o protótipo em jogo Android nativo**; continua sendo o mesmo Babylon.js rodando pelo Chrome.

1. No **Chrome Android**, abra https://raff1play.github.io/BrejoAlegre-WebLab/ .
2. Toque em **Instalar app**. Se o Chrome ainda não oferecer a instalação automática, abra o menu **⋮ → Instalar app** (ou **Adicionar à tela inicial**).
3. Depois de instalar, **abra pelo ícone Brejo Alegre** na tela inicial ou na lista de apps, **não** pela aba normal do Chrome.
4. O manifesto solicita modo `standalone` e orientação `landscape`. No modo aplicativo, não chamamos `requestFullscreen()`; isso evita provocar o aviso cinza de segurança do Chrome quando ele não é necessário.
5. Se o sistema mantiver a orientação vertical, ative **Rotação automática** ou use o botão manual; a preferência de paisagem depende do navegador/Android e **não é garantida**.
6. Se um atalho antigo continuar abrindo uma aba do navegador, remova esse **atalho** e instale a nova versão pelo menu do Chrome.

O service worker usa rede primeiro e cache como alternativa para recursos próprios do jogo, com escopo restrito a `/BrejoAlegre-WebLab/`. O primeiro acesso requer internet; conteúdo offline e atualização após nova versão **ainda precisam ser testados em aparelho real**.

A implementação está em `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` e `src/features/display/pwa.ts`. Os testes unitários de manifesto, ícones e modo standalone ficam em `tests/pwa.test.ts`.

