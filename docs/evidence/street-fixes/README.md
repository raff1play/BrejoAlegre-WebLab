# Correção da prévia de ruas — 14/11/2026

Branch exclusiva: `feat/core-015-2-urban-roads-preview`.
Base da comparação: `887dbd994b9d05e20c82fbfa512a3c481716dad3`.

Capturas reais de Chromium headless/SwiftShader, 1412×652, mesma câmera e hora virtual:

| Cena | Antes | Depois |
|---|---|---|
| Loja de construção | [antes](before/shop.png) | [depois](after/shop.png) |
| Cruzamento OSM inclinado | [antes](before/crossing.png) | [depois](after/crossing.png) |

Reprodução: instalar Playwright fora das dependências da aplicação e executar
`NODE_PATH=<pasta>/node_modules CHROMIUM_PATH=/usr/bin/chromium WEBLAB_URL=http://localhost:5173 WEBLAB_SHOTS=/tmp/street-visual node tests/e2e/street.cjs`.
O servidor deve ser de desenvolvimento para permitir posicionamento determinístico.
A captura aguarda a abertura efetiva da loja; não força nem remove a porta.

## Diagnóstico

- `streetPaint`: as seis barras cruzavam toda a pista e seus centros avançavam pela tangente. Agora onze barras de 3×0,4 m seguem a tangente e se distribuem pela normal, chegando às duas bordas dos 8 m da pista. Testes verificam produtos vetoriais, extensão e pose em curva/sentido inverso. Nenhum eixo OSM ou escala foi alterado.
- `buildStore`: a caixa do barrado envolvia toda a sala; sua face frontal em `STORE_SETBACK + 0.25` criava uma parede de 0,9 m atrás de porta e vitrines. Substituída por três faixas junto às paredes laterais/traseira. O colisor da abertura já estava correto e foi preservado.
- Acabamentos de lojas ultrapassavam a largura do lote (até 10 cm); pilares terminais dos muros de fechamento avançavam até 20 cm sobre os lotes adjacentes. Seus limites agora respeitam o vão reservado.
- Casas: muros laterais ocupavam também o volume dos muros frontal/traseiro; peças agora se encontram nas bordas. Capeamentos foram limitados à largura do lote; o beiral em lotes rasos respeita a profundidade disponível. Não houve remoção indiscriminada de colisores.
- Objeto escuro baixo: `planter_box_02.glb`, jardineira CC0, criada por `shopFurniture`/`externalPlacements`; não é suporte de toldo. A rotação de 90° discordava do colisor. A orientação agora acompanha a fachada; o colisor engloba suas dimensões. Além disso, o quaternion herdado do GLB anulava rotações Euler das instâncias: agora é limpo antes de aplicar a orientação.
- Postes pretos nas extremidades: `street_lamp_01.glb`, mobiliário colonial preservado. Barras finas sobre as vitrines: caixilhos em `buildStore`, preservados. Triângulo e círculo amarelos: indicadores funcionais, preservados.
- `HouseStreamer` desativa o LOD ao criar detalhes: não foi identificada duplicação simultânea de LOD nessa lógica. A malha OSM e os algoritmos de seleção de lotes permaneceram intactos.

## Limites

Capturas e testes de navegador são de Chromium em Linux com GPU por software, não Chrome Android físico. Nenhum resultado de FPS/temperatura no Galaxy S24 é alegado. Não houve incorporação à CORE-015.1.
