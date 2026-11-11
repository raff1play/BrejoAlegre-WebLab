# Tarefa atual — Validar a 0.1 em aparelho real e ajustar por medição

**ESTADO REAL ao escrever (11/11/2026):** a versão 0.1 está implementada na branch `setup/weblab-foundation` (PR #1, rascunho, sem merge e sem deploy) e foi testada em Chromium headless: 25 testes unitários e 44 verificações de navegador (`docs/evidence/`). **Android real, GPU real e FPS não foram testados.** Ver `docs/PROJECT_STATE.md`.

A tarefa anterior ("Implementar Web Lab 0.1 no navegador") está concluída no que o ambiente de nuvem permitia.

## Antes de qualquer coisa

Ler `AGENTS.md`, `docs/00_START_HERE.md`, `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md`. Não recriar o projeto, não abrir outro PR, não tocar em `main`, não fazer merge nem publicar no Pages sem autorização explícita do usuário.

## Passo 1 — o usuário testa no computador e no celular (depende de pessoa, não de IA)

```sh
npm ci
npm run dev
```

Computador: abrir http://localhost:5173. Celular na mesma rede Wi-Fi: abrir `http://IP_DO_COMPUTADOR:5173` no Chrome, em paisagem.

Checklist a preencher e devolver (anotar aparelho, versão do Android e do Chrome):

1. A cena abre? Quanto tempo até aparecer?
2. FPS mostrado no HUD parado, pilotando e na praça, com "Gráficos: leve" e "Gráficos: alto" (botão no painel).
3. ▲ acelera, ▼ freia, ◀ ▶ viram? Dá para acelerar e virar com dois polegares ao mesmo tempo?
4. Algum botão fica preso depois de soltar, ou ao receber notificação/trocar de app?
5. "Descer" só funciona parado? A pé os quatro botões andam? "Montar" funciona perto da moto?
6. ↶ ↷ ＋ － funcionam? Arrastar a cena gira e a pinça dá zoom?
7. Os botões têm bom tamanho e posição? O HUD tampa algo importante?
8. O aparelho esquenta ou o FPS cai depois de 5 minutos?
9. A moto é agradável de dirigir? (aceleração, raio de curva, freio, inclinação, velocidade máxima de 55 km/h)
10. Capturas de tela reais do aparelho.

## Passo 2 — ajustes guiados pelas respostas

- **FPS abaixo de 30 no perfil leve:** em `src/config/graphics.ts`, reduzir `maxPixelRatio` (1,5 → 1,25/1), `shadowMapSize`, `shadowRange`; se ainda faltar, sombra do cenário estática. Registrar antes/depois medidos.
- **Dirigibilidade:** constantes em `MOTO` (`src/core/motorcyclePhysics.ts`); manter os testes de `tests/simulation.test.ts` verdes.
- **Ergonomia de toque:** `src/style.css` (`--pad`, `.pad`, `.camera-bar`) e `index.html`.
- Pendências menores em `docs/ISSUES_AND_RISKS.md` (B011–B015).

## Passo 3 — somente com autorização do usuário

- Marcar o PR #1 como pronto, fazer merge em `main` e disparar o workflow manual do Pages.
- Melhorar a arte com modelos licenciados (moto, piloto, vegetação), registrando cada um em `public/assets/ASSET_MANIFEST.md`.

## Continua proibido

Backend, login, multiplayer, economia, scanner, coletas, entregas, mapa definitivo de Brejo Alegre, tráfego, NPCs, Play Store, serviços pagos, assets comprados, outros repositórios.

## Como validar alterações

```sh
npm run validate:repo && npm run test:unit && npm run typecheck && npm run build:staging
npm run preview                                  # em outro terminal
WEBLAB_URL=http://localhost:4173 npm run test:e2e  # exige Playwright + Chromium no ambiente
```

Ao terminar, atualizar `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md` e `docs/CHANGELOG.md` com SHA, CI e o que foi realmente medido.
