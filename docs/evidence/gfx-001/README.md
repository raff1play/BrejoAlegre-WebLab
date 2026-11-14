# GFX-001 — Evidências (capturas reais do Babylon.js)

Tudo aqui saiu do jogo em execução no Chromium headless, com GPU por software. **Não** são imagens de IA e **não** provam desempenho nem ergonomia em um Galaxy S24 físico.

| Pasta / arquivo | Conteúdo |
|---|---|
| `antes/` | 51 capturas da base `eb8d5c9` (+ sonda de métricas), desktop 1280 × 720 e celular emulado 780 × 360 |
| `depois/` | As mesmas 51 câmeras e horas na GFX-001 |
| `comparacao/*.jpg` | 50 pranchas lado a lado (antes × depois) |
| `comparacao/metricas.md` | Malhas ativas, triângulos, draw calls, texturas e memória JS por cena |
| `e2e/` | Roteiro de navegador completo (`e2e-gfx-001.log`) e suas capturas |

Reproduzir: `npm run dev` e, em outro terminal, `WEBLAB_URL=http://localhost:5173 node scripts/gfx/capture.cjs <pasta> <prefixo>`; depois `node scripts/gfx/compare.cjs docs/evidence/gfx-001`.

Observações honestas:
- As capturas `galpao-recebimento` e `galpao-triagem` do "antes" foram refeitas a partir do commit de base (worktree), porque a câmera original ficava dentro de uma porta de enrolar. O código comparado é o mesmo da base.
- `aereo-centro` usa a câmera de depuração (sem névoa e sem céu), nos dois lados.
- Os tempos de quadro medidos no headless variam com a carga da máquina e não entram na comparação.
