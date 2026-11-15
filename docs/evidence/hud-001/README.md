# HUD-001 + CTRL-001 + MAP-001 — evidências (15/11/2026)

Branch `feat/hud-001-mobile-controls`, a partir de `preview` `1e322aa`. Ambiente: Chromium headless (Playwright) com **SwiftShader** (renderização por CPU, 1–4 FPS), emulação móvel com toque, trânsito ambiente ligado. **Não é teste em Android físico**: ergonomia do polegar, FPS e temperatura no Galaxy S24 continuam pendentes de validação humana.

## Capturas antes/depois (mesmas condições)

Mesmo roteiro para as duas versões (`dia=0`, `gfx=mobile`, `trafego=1`, servidor de desenvolvimento): início na base às 11h45, teleporte de desenvolvimento para a aproximação de um cruzamento real e aceleração pelo teclado, mapa ampliado, desmontar ao lado da moto e toque de um dedo no analógico com 22 px para a direita. Cada imagem traz **antes** em cima e **depois** embaixo.

| Cena | 915×412 | 780×360 |
|---|---|---|
| Base (11h45, baias) | [915x412-base.jpg](915x412-base.jpg) | [780x360-base.jpg](780x360-base.jpg) |
| Pilotando | [915x412-pilotando.jpg](915x412-pilotando.jpg) | [780x360-pilotando.jpg](780x360-pilotando.jpg) |
| Analógico em uso | [915x412-analogico.jpg](915x412-analogico.jpg) | [780x360-analogico.jpg](780x360-analogico.jpg) |
| Mapa ampliado | [915x412-mapa-ampliado.jpg](915x412-mapa-ampliado.jpg) | [780x360-mapa-ampliado.jpg](780x360-mapa-ampliado.jpg) |
| A pé | [915x412-a-pe.jpg](915x412-a-pe.jpg) | [780x360-a-pe.jpg](780x360-a-pe.jpg) |

No mapa ampliado "depois", as paradas numeradas vêm do fixture de desenvolvimento `__debug.previewStops()`, que apenas **exibe** os endereços reais do setor Oeste antes da fase de entregas (nenhum pacote é alterado). Na fase ENTREGAS o mapa usa a rota real (`workday.route`).

## CTRL-001 — direção

### Diagnóstico das três camadas (antes)

1. `stickAxes` (zona morta radial 0,12, raio = 0,36 × largura da zona fixa de 118–148 px): o centro era fixo; deslocamento vertical do polegar reduzia o X por causa da normalização radial.
2. `responsiveMotoSteer` (1,18·x^0,7): a mesma curva em qualquer velocidade.
3. `motorcyclePhysics` (`steerSpeedRef=7.5`, `maxLateralAccel=8`): a 25–40 km/h o limite de aderência já satura com 40–60 % de esterço.

Resultado: a 10 km/h, 50 % do polegar entregava só 61 % da curva possível (pesado em manobras); a 40 km/h, 25 % já entregava 75 % (nervoso).

### Mudança

- **Joystick flutuante** (`virtualJoystick.ts`): toda a zona inferior esquerda (`min(40vw, 400px)` × `62vh`) aceita o polegar; o centro nasce no `pointerdown` e acompanha o polegar quando ele passa do anel, até 1,6 raio do primeiro toque (padrão dynamic/follow, sem biblioteca). O anel fica esmaecido na posição de repouso.
- **Moto, eixo X axial** (`motoTurnFraction`): zona morta só horizontal 0,06; curva ease-out; curva completa a 72 % do raio. Expoente 2,2 até 25 km/h, 1,6 a partir de 40 km/h.
- **Normalização pela curva disponível** (`steerForTurn`): o polegar pede uma fração da taxa de guinada que a física permite naquela velocidade (inversa exata do modelo de bicicleta). **Limites físicos inalterados**: deflexão total = mesma curva máxima de antes (teclado idem). `MOTO` não foi modificado.
- A pé: mesmo `stickAxes` radial (0,12), 360°.

| Parâmetro | Antes | Depois |
|---|---|---|
| Centro do analógico | fixo (zona circular 118–148 px) | flutuante, no primeiro toque; acompanha até 1,6 raio |
| Raio lógico | 0,36 × largura da zona (≈ 42 px a 412 px de altura) | `--stick-r` = clamp(36 px, 11vh, 56 px) (≈ 45 px a 412 px) |
| Zona morta moto | 0,12 radial | 0,06 só no eixo X |
| Curva moto | 1,18·x^0,7, igual em toda velocidade | ease-out, saturação 0,72, expoente 2,2 → 1,6 (25 → 40 km/h) |
| Saída | ângulo de esterço | fração da guinada possível na velocidade atual |
| Física (`MOTO`) | `maxSteerAngle 0.67`, `steerSpeedRef 7.5`, `maxLateralAccel 8`, `steerInRate 5`, `steerOutRate 8` | **inalterada** |

### Comparativo medido na física real (`tests/analogStick.test.ts`)

Taxa de guinada em °/s com o comando mantido (100 % = máximo da física naquela velocidade, idêntico antes/depois). Esquerda é simétrica (verificado no teste).

| Velocidade | Deflexão | Antes | Depois |
|---|---|---|---|
| 10 km/h | 25 % | 21,8 (28 %) | 41,7 (53 %) |
| 10 km/h | 50 % | 48,2 (61 %) | 72,2 (91 %) |
| 10 km/h | 75 % | 72,7 (92 %) | 79,3 (100 %) |
| 25 km/h | 25 % | 33,7 (50 %) | 34,7 (52 %) |
| 25 km/h | 50 % | 66,9 (100 %) | 60,1 (90 %) |
| 25 km/h | 75 % | 66,9 (100 %) | 66,0 (99 %) |
| 40 km/h | 25 % | 31,5 (75 %) | 17,4 (42 %) |
| 40 km/h | 50 % | 41,8 (100 %) | 34,3 (82 %) |
| 40 km/h | 75 % | 41,8 (100 %) | 41,4 (99 %) |

Leitura: mais leve em manobra (10 km/h: +91 % de guinada a 25 % do polegar), igual ou levemente mais ágil a 25 km/h com movimento curto, e bem mais estável a 40 km/h (um toque curto não "trava" mais no limite de aderência). Como a guinada máxima não mudou, o risco de colisão não aumenta além do que o teclado já permitia; colisões (`slideMove`/`motoFits`) não foram tocadas.

## MAP-001 — minimapa

| Item | Antes | Depois |
|---|---|---|
| Orientação | norte para cima sempre | pilotando: direção da moto para cima, piloto a 62 % da altura, emblema N que gira; a pé e ampliado: norte para cima |
| Zoom | raio fixo 80 m | 55 m (≤ 10 km/h) → 115 m (≥ 45 km/h), suavizado (1,5/s), banda morta de 6 m |
| Rota | linha ciano, recalculada a cada 15 m andados | traço de alto contraste só do trecho restante; recalcula quando o objetivo muda ou após 1,2 s a > 18 m da rota, com intervalo mínimo de 3 s |
| Ícones pilotando | lojas, galpão, paradas | só galpão, objetivo, próxima parada (demais paradas como pontos) |
| Próxima conversão | — | ↰/↱ + distância apenas em cruzamentos reais (≥ 3 ruas no grafo OSM) e mudança de rumo ≥ 30°; sem conversão até o destino: ↑ + distância restante |
| Ampliado | ruas, nomes, POIs, paradas | + setores (cunhas reais de `sectorOf`), paradas numeradas na ordem da rota, próxima em destaque, contagem de paradas restantes; atribuição © OpenStreetMap contributors mantida |
| Atualização | ~8 Hz | ~11 Hz pilotando, ~8 Hz nos demais casos |

**Limitações documentadas:** não há ETA (não existe dado confiável de velocidade de via/trânsito). A seta de conversão some quando o piloto está fora da rota (> 18 m) até o recálculo, para nunca mostrar uma instrução errada. A rota parte da rua mais próxima e não considera o sentido em que a moto está virada (pode pedir retorno). Não há nome da rua de destino da conversão na barra (só no mapa ampliado).

### Custo de renderização do minimapa

Medido com a mesma instrumentação nas duas versões (cópias temporárias fora do repositório), 6 s pilotando, SwiftShader, DPR 1:

| Versão | 915×412 ms/redesenho | 780×360 ms/redesenho |
|---|---|---|
| Antes | 0,18–0,23 | 0,23–0,25 |
| Depois | 0,36–0,38 | 0,33–0,36 |

O redesenho rotacionado custa ≈ +0,15 ms (drawImage não alinhado aos eixos + projeção na rota). A ~11 Hz isso é ≈ 4 ms por segundo, menos de 0,5 % do orçamento de quadros a 60 FPS. A camada estática continua pintada uma única vez. O FPS do jogo no SwiftShader (1–4) não é representativo de dispositivo.

## HUD-001

- Três apresentações por `#hud[data-context]` (riding/walking/base) + `data-mode`: um atributo por troca, sem novo estado de logística.
  - **Pilotando:** objetivo, distância, relógio, velocidade, minimapa com próxima conversão, pedais.
  - **A pé:** objetivo, ação contextual, volumes nas mãos/no baú; velocidade e distância ocultas, pedais esmaecidos (continuam funcionando).
  - **Na base** (dentro do lote do galpão): recebimento, triagem, carga D02 pronta, meta de triagem, saca 15h, jornada até 21h.
- **Meu × equipe:** "Minha coleta x/y" / "Minhas entregas x/y" (contorno âmbar) separado de "Equipe x/y" (neutro). Antes: "Coletados 0/9 · Entregues 0/53" misturava os quatro setores.
- Avisos (toast) saem do centro e ficam sob o objetivo.
- CSS consolidado em um arquivo sem blocos sobrescritos (seletores mortos `.brand`, `.status-panel`, `.prototype-label`, `.camera-bar`, `.joystick-caption`, `button.link` removidos). Rótulo "EXPERIMENTO · RUAS E SINALIZAÇÃO" e título "(experimento)" removidos; relógio do HTML 11:45.
- Calendário, painel de Logística, liberação da equipe, pausa e gráficos inalterados.

## Testes executados

- `npm run check`: validação, **155/155** unitários, TypeScript e build staging aprovados.
- `npm run test:e2e` (Chromium + SwiftShader, trânsito ligado): **73/73** verificações em três execuções consecutivas (versão final do roteiro). Cobre: início 11h45; NPCs às 11h47; IDs únicos; HUD base/pilotando/a pé com sobreposição zero entre 7 painéis e centro livre em 915×412 e 780×360; mapa ampliado norte para cima com crédito OSM; calendário e Logística; heading-up; zoom por velocidade; próxima conversão; multitoque real (CDP) analógico + acelerador; soltar um dedo/último dedo, `touchcancel`, perda de foco; centro flutuante e acompanhamento limitado; recálculo único ao sair da rota e ausência de recálculos em seguida; 360° a pé sem deriva; montar de novo; tráfego e NPCs ativos ao final.
- Durante a estabilização do roteiro houve falhas intermitentes **do teste** (esperas fixas com 1–4 FPS no SwiftShader); foram trocadas por esperas de condição, sem afrouxar as asserções.

## Pendências

- Calibração ergonômica no Galaxy S24 físico (o raio de 11vh e a zona morta 0,06 são estimativas).
- Fase ENTREGAS completa no navegador com o mapa real (as paradas reais só foram exibidas via fixture de exibição).
- Medir FPS/temperatura em dispositivo.
