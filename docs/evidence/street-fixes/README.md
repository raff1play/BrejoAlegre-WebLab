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

## Resultados finais

- `npm run check`: **99/99** testes unitários, TypeScript, validação e build staging aprovados; [log](check.txt).
- Teste visual real antes/depois: aprovado; [log](visual.txt).
- Roteiro amplo (desktop, jornada, toque) com resolução interna reduzida para SwiftShader: **83/84**; [log integral](e2e-low-resolution.txt). A única falha foi o teste que esperava render 900×420 e recebeu 225×105 por causa da redução explícita. O [adaptador](runner-low-resolution.cjs) registra exatamente essa condição, sem alterar física ou relógio.
- Repetição integral do bloco desktop **sem redução**: **33/33**, incluindo render 900×420; [log](e2e-desktop-original.txt). Assim, todas as verificações funcionais passaram nas condições apropriadas; a rodada reduzida não é apresentada como 84/84.
- Jornada: 8/8 entregues, coleta/baú/galpão/saca, HUD, minimapa, tráfego e cinco sinais fictícios aprovados. Toque emulado: multitoque, cancelamento, câmera, montar/descer e pausa aprovados. Sem erros de console.
- Rodadas iniciais com edição ao vivo foram interrompidas por recarga do Vite; uma rodada de alta resolução concorrente teve timeout na pilotagem. A repetição final sem alterações ao vivo passou. Não são resultados de aparelho físico.

## Publicação

[Deploy 43553500987](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43553500987): **Success**, SHA `1d96bd3ae94eae0b7374eac91610b55e3416e1fa`. [CI 43553501002](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43553501002): **Success**.

[Prévia experimental](https://raff1play.github.io/BrejoAlegre-WebLab/street-preview/). O workflow preserva CORE-015.1 na raiz; nenhum merge. O ambiente retornou HTTP 403 para acesso direto ao Pages, portanto a confirmação pós-publicação vem do GitHub Actions. Android físico permanece pendente.
