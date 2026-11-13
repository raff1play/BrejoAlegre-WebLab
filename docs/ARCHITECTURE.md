# Arquitetura do Web Lab — simplicidade verificável

## Visão

```text
index.html / HUD CSS
        |
      main.ts (composição)
       /  |  \
     input camera (Babylon.js Scene)
        |      |
     features/ -> core/ -> world/
        |               |
     moto/pedestre   cena temporária + colisores

config/environment.ts <- .env.development / .env.staging / .env.production
```

`src/core/` contém regras puras que não importam Babylon.js; `tests/` exercita essas regras sem renderer. `src/features/` possui comportamento e controle; `src/world/` constrói o cenário provisório; `src/main.ts` faz a composição, não deve absorver mecânicas de gameplay futuras. `src/config/` só define ambiente e flags de apresentação.

## Caminho da entrada até a tela (0.1)

Teclado/toque → `GameInput` (`InputState` por fonte: teclado ou um ponteiro por dedo) → `main.ts` converte em controles → `stepMotorcycle` ou `stepWalker` (puros, com `dt`) consultando o `MotionGuard` do mundo → os modelos (`Motorcycle`, `Pedestrian`) copiam o estado para os nós → `IsometricCameraRig` segue o alvo → `OcclusionFader` e sombra → HUD → render.

Só um corpo recebe controles por vez (`mode` em `main.ts`); ao trocar, as entradas mantidas são zeradas.

## Mundo

`src/world/layout.ts` é a planta **fictícia** em dados puros (lotes, colisores, áreas elevadas, oclusores, árvores, postes). Os testes verificam a planta sem renderizador. `temporaryWorld.ts` desenha a partir dela, fundindo a geometria estática por material (`geometry.ts`), com cor por vértice para superfícies pintadas; isso mantém ≈ 160 draw calls por quadro.

## Modelos articulados (W009)

- `src/world/modelParts.ts`: primitivas auxiliares (caixas, hastes, esferas, toros de baixa contagem) fundidas por `BatchSet`. Fica em `world/` porque casas e moto usam; `world/` não importa de `features/`.
- `src/features/shared/character.ts`: entregador com um `TransformNode` por segmento, posicionado a cada quadro por IK de dois ossos (`src/core/ik.ts`, puro e testado) a partir de uma `Pose`. Usado pelo piloto (`driving/motorcycle.ts`) e pelo pedestre (`walking/pedestrian.ts`).
- `src/features/shared/rigidSkin.ts`: cada nó animado recebe um osso ligado (`Bone.linkTransformNode`) e toda a geometria de um material vira **uma** malha com skinning rígido na GPU. Para esconder uma peça, zere a escala do nó (ex.: descanso lateral); `setEnabled` não esconde parte de uma malha fundida.
- A apresentação só lê o estado de `core/` (velocidade, esterço, inclinação, posição); nenhuma animação altera a simulação.

## Vegetação e fundo (CORE-010)

- `src/world/foliage.ts`: copas por **cartões de folhagem** (quads com textura alfa recortada, em `Materials.leafCards`) espalhados num elipsoide, com normais apontando para fora da copa e cor por vértice; um núcleo escuro de baixa contagem evita transparência. Cada espécie é um protótipo instanciado (árvores em `props.ts`).
- `src/world/backdrop.ts`: morros, casario, igreja e caixa-d'água fictícios além dos muros; uma malha por material, sem sombra nem colisão.
- Mobiliário da vitrine (`showcaseStreetItems` em `layout.ts`): floreiras instanciadas; postes coloniais e lixeiras no lote estático compartilhado; todos com colisor.

## Assets externos (CORE-011)

- `src/world/externalAssets.ts`: registra apenas o loader glTF 2.0 + `EXT_texture_webp` (sob demanda), carrega `public/assets/models/*.glb` depois que o mundo procedural existe, incorpora a transformação glTF (mão direita → esquerda) nos vértices, converte PBR em `StandardMaterial` e instancia conforme `externalPlacements()` (derivado de `layout.ts`). Se um modelo falhar, `main.ts` gera a peça procedural equivalente (`buildStreetFurniture` com `flowers: false`).
- `applyRoofTexture()`: troca a telha pintada pela foto CC0; mapa normal só no perfil alto.
- **Não** importar `PBRMaterial` (nem `registerBuiltInLoaders`) estaticamente: puxa o PBR/loaders inteiros para o bundle inicial.
- Otimização de novos assets: `@gltf-transform/cli optimize --compress false --texture-compress webp --texture-size 512 --simplify-ratio …` fora do projeto (sem Draco/meshopt, que exigiriam decodificador baixado em tempo de execução).

## Limitações PROPOSITADAS

- Moto: modelo cinemático de bicicleta com limite de aceleração lateral. **Não é corpo rígido**: sem suspensão, derrapagem ou queda.
- Colisão: círculos contra caixas alinhadas aos eixos em X/Z, com deslizamento por eixo. Sem colisão dinâmica entre objetos móveis (só pedestre × moto estacionada).
- Arte em primitivas e texturas procedurais; sem carga, combustível, NPCs ou tráfego.
- Não há backend. O bundle roda em hospedagem estática.
- Sem salvamento de progresso; `localStorage` guarda apenas o perfil gráfico escolhido.
- Não reservar trabalho para sincronização de rede nesta fase.

## Restrições técnicas

- Módulos importam em uma direção simples: `features` e `world` podem importar `core`; `core` NÃO importa `features`, `world`, Babylon ou DOM. Arquivos de `core/` e `world/layout.ts` usam imports com extensão `.ts` para rodarem direto no `node --test`.
- Importar o Babylon sempre por caminho específico (`@babylonjs/core/Meshes/mesh`), nunca pelo índice `@babylonjs/core`: isso reduziu o bundle de 7,2 MB para 1,3 MB.
- `DynamicTexture` vem em modo clamp; texturas que repetem precisam de `WRAP_ADDRESSMODE` (ver `paintTexture`).
- Configuração via `VITE_*` é pública no bundle. Nunca adicionar chaves privadas em `.env` do Vite.
- Scripts de migração/infraestrutura e segredos são proibidos no protótipo local sem decisão explícita.
- Não carregar assets pesados antes de provar FPS e orçamento gráfico no celular.

## Critério de separação

Nova feature → pasta `src/features/<name>/` com controlador e API clara; regras independentes → `src/core/` + teste unitário; modelos/arte → `public/assets/` com manifesto de licença; dados geográficos → `src/world/` com proveniência e aviso de placeholder quando aplicável.

## Câmera dupla (CORE-012)

- `src/features/camera/isometricCamera.ts` preserva um único `ArcRotateCamera` com dois presets: `isometric` (padrão) e `third-person` (estilo GTA), alternados por botão GTA/ISO ou tecla C. A configuração isométrica é guardada ao alternar e restaurada depois.
- `src/core/cameraFollow.ts` calcula ângulo atrás do rumo, interpolação pelo arco angular mínimo e distância segura até o primeiro volume sólido; pode ser testado em Node sem Babylon.
- `src/world/cameraObstacles.ts` fornece caixas estáticas de prédios, muros, troncos, postes e objetos próximos. Apenas a câmera usa esses volumes; colisões de moto/pedestre permanecem intactas.
- Na moto há acompanhamento automático do rumo após 2,5 s de inatividade manual; a pé, a câmera fica livre e a caminhada permanece relativa à direção observada.
- `GameInput` dispara a ação `camera-mode`; `Hud.setCameraMode` atualiza rótulo acessível e botão. O snapshot de diagnóstico informa `camera.mode`.
- Risco conhecido: copas volumosas e detalhes não incluídos nas caixas simplificadas podem obstruir parcialmente a visão. Desempenho e conforto no Galaxy S24 ainda precisam ser testados.

## Cidade viva (CORE-013)

- **Dados puros:** `src/world/city/cityPlan.ts` (nós, vias, quadras, lotes, lojas, galpão, pontos de ônibus, lombadas) e `cityLayout.ts` (postes, árvores, muros de testada, colisões). Mesma fonte para mundo 3D, tráfego, pedestres e minimapa.
- **Regras puras e testadas em Node (`src/core/city/`):** `roadGraph.ts` (faixas, conversões, matriz de conflitos, Dijkstra por viagem), `signals.ts` (fases exclusivas), `traffic.ts` (IDM, admissão em cruzamentos, rotas de ônibus/vans/caminhões, população conforme a hora, despawn longe/nas saídas), `pedestrians.ts` (grafo de calçadas, FSM), `clock.ts` (1 h = 240 s; jornada 11–21; atividade por hora), `dayNight.ts` (sol, céu, névoa, sombras).
- **Apresentação (`src/features/city/cityLife.ts`):** thin instances por protótipo (≈ 3 draw calls por tipo de veículo, 3 para pedestres, 1 para lâmpadas de semáforo); cores por instância; poças de luz e faróis só à noite. NPCs distantes atualizam em frames alternados e somem além de 150–190 m.
- **HUD:** `src/features/hud/minimap.ts` (canvas 2D, camada estática pintada uma vez, redesenho a ~8 Hz) e relógio no `hud.ts`. `src/world/environment.ts#applyLighting` aplica a luz duas vezes por segundo.
- **Colisão com o jogador:** veículos NPC bloqueiam a moto/pedestre (retângulo orientado); se já houver sobreposição, só o mundo estático bloqueia para o jogador conseguir sair.

## Entregas (CORE-014)

- **Regras puras (`src/core/delivery/`):** `addresses.ts` (48 endereços, numeração métrica), `parcels.ts` (fluxo de estados que só avança), `stores.ts` (horários, porta de enrolar, rotina do funcionário, fila), `workday.ts` (rotina 11h–21h, galpão: conferência, triagem, saca, equipe de 8 papéis, objetivos).
- **Plantas:** `storeLayout()` e `depotLayout()` em `cityPlan.ts` geram paredes, balcões, estoque, filas e pontos de interação — usados por colisão, câmera, renderização e NPCs.
- **Apresentação:** `src/features/delivery/deliveryGame.ts` (funcionários `NpcPerson`, clientes da multidão na fila, marcador de objetivo, ação contextual); `src/features/city/npcPerson.ts` (personagem articulado civil); `vehicleModels.ts` (veículos NPC).
- **LOD de pessoas:** os mais próximos (até 10/5 por perfil) usam o personagem articulado (um por visual, 12 visuais); os demais, figuras instanciadas com as mesmas cores.

## CORE-015 — Geografia real

- **Dados:** `data/osm/*.json` (bruto) → `scripts/geo/import-osm.mjs` → `src/world/geo/brejoAlegreData.ts` (`GEO`, gerado).
- **Rede:** `src/world/geo/network.ts` corta as vias carroçáveis em `NET_BOUNDS`, divide nos nós compartilhados e classifica em urbana ou rural (`SEDE`). `PLAY_BOUNDS` é o limite do jogador.
- **Quadras e lotes:** `src/world/geo/geoCity.ts` monta as faces do grafo planar (quadras), recua meio-fio e divisa, gera lotes orientados nas frentes e muros nas sobras, e define as quadras das lojas e a do galpão.
- **Plano da cidade:** `src/world/city/cityPlan.ts` adapta a rede (`ROADS`, `NODES`, `BLOCKS`, `CITY_LOTS`, `STORES`, `depotWorld`/`depotYaw`) para tráfego, pedestres, colisão, minimapa e entregas.
- **Colisão:** polígonos convexos com `SpatialIndex` (`src/core/collision.ts`); a câmera usa caixas orientadas (`Box3D.yaw`).
- **Streaming:** `src/features/city/houseStreamer.ts` gera LOD por setor de 100 m e detalhe perto do jogador.
- **Verificação:**
  - `tests/geo.test.ts`;
  - `scripts/geo/compare-map.ts` reprojeta o OSM bruto de forma independente, compara e grava as métricas;
  - `scripts/geo/compare-shots.cjs` gera as imagens;
  - `src/world/city/testProbe.ts` fornece cruzamento e lote reais para o e2e (só em desenvolvimento).
