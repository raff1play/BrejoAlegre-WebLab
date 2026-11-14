# CORE-015.1 — Evidências (capturas reais do Babylon.js)

Todas as imagens vêm do jogo em execução no Chromium headless (GPU por software). Elas **não** provam desempenho nem ergonomia em um Galaxy S24 físico.

| Arquivos | O que mostram |
|---|---|
| `comparacao-*.jpg` | Antes (CORE-015, `cb0dd6f`) × depois (CORE-015.1), mesma câmera: rua sem saída, lote raso, casas vizinhas, esquina, as oito lojas, mapa ampliado, HUD no celular emulado |
| `antes-*.jpg`, `depois-*.jpg` | As capturas originais usadas nas comparações |
| `depois-hud-celular-maos.jpg`, `depois-hud-celular-bau.jpg` | HUD 780 × 360 com "2 volumes nas mãos" e a ação "Guardar no baú (2)" |
| `e2e/*.jpg`, `e2e/e2e-core015-1.log` | Roteiro de navegador completo: **84/84**. Baú: `14-bau-guardando.jpg`, `15-bau-retirando-pacote.jpg`; mapa: `16-mapa-ampliado-celular.jpg` |

Não há "antes" da calçada vista do chão: a captura feita com a câmera de depuração mostrava a rua verde por um defeito da própria câmera de depuração (plano distante de 5 km), não do jogo, e foi descartada para não enganar. O "antes" real da rua está em `docs/evidence/core015-e2e/02-pilotando-rua.jpg`.

A comparação cartográfica da CORE-015 (`docs/evidence/core015-mapa/`) foi regenerada com o minimapa novo: cobertura 100 %/100 %, 87/87 cruzamentos.
