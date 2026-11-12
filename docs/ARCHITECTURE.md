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
