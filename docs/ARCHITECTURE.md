# Arquitetura — Web Lab atual (LOG-006)

```
index.html + style.css (HUD e touch)
         |
    src/main.ts — composição, loop Babylon e estado global
    |            |             |
features/     core/          world/
HUD, controles e NPCs    estado/pacotes/IA    cidade 3D, OSM, colisões
         |        |
    minimap    LogisticsDay > Workday > DepotOperations
```

**Roteiro de fluxo:** entrada touch/teclado → `features/controls/input.ts` → movimento do piloto/moto em `core/motorcyclePhysics.ts` e `core/walking.ts` → `world/temporaryWorld.ts` (geometria e guardas) → `features/city/cityLife.ts` (tráfego/pedestres) → `features/delivery/deliveryGame.ts` (pessoas, loja, base) → HUD e minimapa.

**Inventário único:** `core/delivery/parcels.ts` mantém ID, localização, estado, holder e histórico. `LogisticsDay` orquestra jogadores/NPCs, calendário, carga regional e saída conjunta; `Workday` e `DepotOperations` realizam operações físicas por tarefa. Não duplicar inventário em classes de visão.

**Cidade:** `src/world/geo/brejoAlegreData.ts` deriva de dados OSM registrados em `data/osm` e scripts de importação. `cityPlan` e `cityLayout` centralizam ruas, lotes, paredes e zonas de interação; `streetRoute` atende minimapa e rotas NPC; `traffic` e `courierRoutes` devem concordar sobre bloqueios.

**UI:** `features/hud/hud.ts` exibe objetivo e telemetria e troca a apresentação por `#hud[data-context]` (pilotando/a pé/base, decidido em `hudContext.ts`, funções puras sobre o estado existente); `minimap.ts` redesenha a ~11 Hz pilotando (~8 Hz nos demais) a partir de uma camada estática em cache, com orientação pela moto, zoom por velocidade e guia de conversão de `core/city/navigation.ts` (cruzamentos marcados por `streetRoute`); `logisticsPanel.ts` mostra equipe/calendário. A HUD altera apresentação; **não** altera lógica de pacotes/veículos por estética.

**Controles:** `virtualJoystick.ts` (analógico flutuante, um ponteiro) → `core/analogStick.ts` (curvas puras: `stickAxes` a pé, `motoTurnFraction` + `steerForTurn` na moto, normalizando pela guinada que `motorcyclePhysics` permite na velocidade) → `input.ts`. Parâmetros em `STICK_TUNING`.

**Build:** Node 22, TypeScript strict, Vite com `base:'./'` para Pages. `.env.*` são marcadores públicos; nunca inserir segredos. `main` não contém servidor ou backend. Babylon.js deve ser importado por módulos específicos para limitar bundle.

**Diagnóstico:** `window.__weblab.snapshot()` expõe visão de leitura de mundo e pacotes; `window.__debug` só existe em `import.meta.env.DEV`. Testes com teleporte/fixture e SwiftShader não substituem pilotagem em dispositivo físico.
