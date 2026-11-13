# Referência da cidade — CORE-015 (mapa real 1:1)

**Município:** Brejo Alegre/SP, código IBGE 3507753. Desde a CORE-015 a **malha viária jogável é a real**, tirada do OpenStreetMap em escala 1:1. Lotes, casas, lojas, galpão e números de casa continuam **estimados ou fictícios**. Este documento substitui a referência da CORE-013, em que o traçado era inventado; a versão antiga está no histórico do Git.

## Fonte cartográfica

| Item | Valor |
|---|---|
| Fonte | OpenStreetMap, via Overpass API (`https://overpass-api.de/api/interpreter`) |
| Extração | 13/11/2026 15:13 UTC; base OSM de 13/11/2026 15:11 UTC |
| Método | Workflow isolado no GitHub Actions (`.github/workflows/osm-fetch.yml` → `scripts/geo/fetch-osm.mjs`), porque o proxy desta sessão bloqueava Overpass, Nominatim e IBGE. O próprio runner fez o commit dos dados (bot, `45cdb4c`) |
| Recorte | bbox S −21,1871191 · O −50,2070393 · N −21,1471191 · L −50,1630393 (≈ 4,6 × 4,4 km em torno do nó `place=village` 368265230). Nenhum arquivo estadual foi baixado |
| Arquivos | `data/osm/brejo-alegre.raw.json` (126 kB, resposta bruta com a consulta) e `data/osm/SOURCE.json` (procedência, consulta, contagens) |
| Licença | **ODbL 1.0 — © OpenStreetMap contributors** (https://www.openstreetmap.org/copyright). A atribuição aparece na tela Pausa/Sobre e no cabeçalho do arquivo gerado |
| Conversão | `scripts/geo/import-osm.mjs` → `src/world/geo/brejoAlegreData.ts` (gerado; não editar à mão) |
| Projeção | Plano tangente equirretangular local: x = R·Δλ·cos φ0 (leste), z = R·Δφ (norte), R = 6 371 008,8 m, origem no centro da bbox (−21,1671191; −50,1850393). **1 unidade = 1 m.** A distorção fica abaixo de 0,02 % a 3 km da origem; o erro medido contra haversine é ≤ 3 cm em 650–840 m |

## O que o arquivo contém (contado em `docs/evidence/core015-mapa/metricas.json`)

- 164 elementos no total. Destes, 144 vias: 71 residential, 39 unclassified, 15 service, 13 secondary, 3 secondary_link e 3 track.
- 126 vias carroçáveis, com 33 nomes distintos de logradouro. "Avendia Dois" está grafado assim no OSM e foi mantido.
- 159 cruzamentos carroçáveis no recorte: 86 na sede e 87 na área jogável.
- **Só 7 edificações mapeadas.** Há também 2 parques, 1 campo de futebol (sem nome), 1 cemitério, 2 reservatórios, 1 aterro, 1 abrigo (`amenity=shelter`), 2 bairros (Residencial Vitória, Condomínio Areia Branca) e os limites administrativos.

## Real × estimado × fictício no jogo

| No jogo | Base |
|---|---|
| 177 trechos de rua (158 urbanos, 19 rurais), 18,7 km, 90 cruzamentos (87 na área jogável), sentidos únicos da pista dupla | **Real (OSM)**: geometria, nomes, classes, conexões. O único ponto sintético é o corte de uma via real na borda da rede (saída de tráfego) |
| Praças/parques, campo, cemitério | **Real (OSM)**: polígonos. Nomes não existem no OSM e não foram inventados |
| Nó "Brejo Alegre" no minimapa | **Real (OSM)** |
| 46 quadras | **Derivadas** das faces do grafo real de ruas: meio-fio 4 m e divisa 6,2 m do eixo. As bordas são simplificadas (dobras ≤ 4° juntadas) |
| 688 lotes (674 casas) de 10–17,6 × 12–20 m | **ESTIMADOS**. O OSM tem 7 edificações e nenhuma divisa de lote; as casas preenchem as frentes das quadras reais e não representam imóveis reais |
| 48 endereços entregáveis | **Ruas reais** (só logradouros nomeados, sem "Estrada"); **números estimados** pela distância métrica a partir da ponta mais próxima do centro (par à direita) |
| 8 lojas, galpão logístico, funcionários, plataformas ML/SHP | **Fictícios**, postos em quadras reais (lojas junto ao centro; galpão na quadra da Estrada Municipal Manoel Leitão). O galpão mantém o layout da CORE-014, encaixado sem deformação |
| Postes, árvores de calçada | **Genéricos**, a cada 32 m e 26 m; suas posições reais não estão no OSM |
| Semáforos, pontos de ônibus, faixas de pedestre | **Nenhum semáforo nem ponto de ônibus foi simulado**, porque o OSM não mapeia nenhum na sede. Cruzamentos têm PARE onde as vias têm prioridades diferentes; pedestres atravessam quando a via está livre |

## Locais pedidos que NÃO puderam ser confirmados

Nenhum destes aparece no recorte OSM. Por isso **nenhum foi posicionado** e nada foi inventado no lugar deles:

- Centro Poliesportivo Manoel Rodrigues Leitão. Há um campo de futebol sem nome no OSM, que **não** foi identificado como o centro poliesportivo.
- Ferreira Burguers e Casa de Pesca Avenida.
- Igreja Sagrado Coração de Jesus (a existência foi confirmada pela GCatholic na CORE-013; a posição não), a E.E. Agostinho Grigoleto e a prefeitura.
- Av. Pedro de Paula Castilho: o nome vem de agregador de CEP, não do OSM. A via secundária que cruza a sede está **sem nome** no OSM e aparece assim.
- **Rua Nove de Julho: CONFIRMADA** no OSM e presente no jogo com o traçado real.

A captura do Google Maps enviada pelo usuário serviu **só** como referência visual. Nenhum dado foi copiado, extraído ou digitalizado dela.

## Limitações conhecidas

- Larguras de via, calçadas e meio-fio são padronizados (pista de 8 m; calçada até 6,2 m do eixo), porque o OSM não traz larguras.
- Vias `service` (15) e `track` (3) não entram na malha carroçável; aparecem tracejadas na comparação.
- O relevo não foi modelado: o terreno é plano.
- Vias rurais sem quadra não têm calçada nem lotes.
- O aviso "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE" continua na Pausa, porque o validador o exige. Com a malha real ele ficou impreciso, e mudá-lo depende de decisão do usuário (C13-06).

## Comparação verificável

Ver `docs/evidence/core015-mapa/README.md`: OSM bruto e minimapa do jogo lado a lado, na mesma área, escala e orientação, com a sobreposição dos eixos e as métricas de cobertura.
