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

**UI:** `features/hud/hud.ts` exibe objetivo e telemetria; `minimap.ts` redesenha mapa a ~8 Hz; `logisticsPanel.ts` mostra equipe/calendário. O próximo passo HUD-001 altera apresentação; **não** altera lógica de pacotes/veículos por estética.

**Build:** Node 22, TypeScript strict, Vite com `base:'./'` para Pages. `.env.*` são marcadores públicos; nunca inserir segredos. `main` não contém servidor ou backend. Babylon.js deve ser importado por módulos específicos para limitar bundle.

**Diagnóstico:** `window.__weblab.snapshot()` expõe visão de leitura de mundo e pacotes; `window.__debug` só existe em `import.meta.env.DEV`. Testes com teleporte/fixture e SwiftShader não substituem pilotagem em dispositivo físico.
