# CORE-015 — Comparação cartográfica verificável

Mapa: © OpenStreetMap contributors, ODbL 1.0. Extração de 13/11/2026 (`data/osm/SOURCE.json`).

## Como reproduzir

```bash
node --experimental-strip-types scripts/geo/compare-map.ts
```

```bash
npm run dev
```

```bash
WEBLAB_URL=http://localhost:5173 node scripts/geo/compare-shots.cjs
```

- `compare-map.ts` relê o arquivo **bruto** (`data/osm/brejo-alegre.raw.json`) e **reprojeta** latitude/longitude por conta própria, sem usar o importador. Depois compara com a rede que o jogo realmente usa (`NETWORK`) e grava `metricas.json`, `osm-bruto.svg` e `osm-sobreposicao.svg`.
- `compare-shots.cjs` extrai do jogo em execução a **camada estática real do minimapa** (`__debug.minimapBase()`, só em desenvolvimento, 1,2 px/m) e monta as imagens.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `lado-a-lado.png` | OSM bruto (esquerda) e minimapa do jogo (direita): mesma área (1370 × 1220 m), mesma escala (1,2 px/m), norte para cima |
| `sobreposicao.png` | Eixos OSM em vermelho sobre o minimapa do jogo (tracejado = `service`/`track`, fora da malha) |
| `centro-sobreposicao.png` | Detalhe do centro, 460 × 460 m, em 3,6 px/m |
| `aereo-3d-centro.jpg` | Vista 3D aérea do centro, só para comparação visual: perspectiva, **fora de escala** |
| `osm-bruto.png` / `minimapa-jogo.png` | Cada mapa sozinho, em tamanho natural |
| `metricas.json` | Todas as contagens e medições abaixo |

## Resultados (tolerância de 1 m)

| Medida | Valor |
|---|---|
| Malha carroçável do OSM, dentro da área jogável, coberta por vias do jogo | **100 %** (amostra a cada 1 m; desvio máximo 0,07 m) |
| Vias do jogo, dentro da área jogável, que estão sobre vias OSM | **100 %** |
| Cruzamentos OSM na área jogável que existem no jogo | **87/87** |
| Cruzamentos do jogo que não são cruzamentos OSM | 0 (os 3 a mais da rede desenhada ficam fora da área jogável, nas vias de acesso) |
| Erro de escala (distância no jogo × haversine sobre lat/lon), 6 pares de 450–840 m | ≤ **0,029 m** |
| Extensão da malha dentro do recorte da sede | 1178 m (O–L) × 1056 m (S–N) |

## Diferenças conhecidas (o mapa NÃO é 100 % fiel)

- **Edificações:** o OSM tem 7 edificações e o jogo tem 674 casas **estimadas** em lotes regulares. As manchas laranja do painel OSM são os únicos prédios reais mapeados; o jogo não os reproduz um a um.
- **Lojas, galpão, números de casa e pessoas são fictícios.** O galpão ocupa a quadra triangular do norte, em lugar onde o OSM não mostra nada.
- **Vias `service` (15) e `track` (3) ficaram fora** da malha carroçável.
- **Quadras:** o meio-fio é um recuo constante de 4 m do eixo, e as bordas foram simplificadas (≤ 4°). Por isso uma esquina curva pode ficar até ~1 m fora do traçado real.
- **Larguras padronizadas**, porque o OSM não traz largura de via nem de calçada.
- **Sem relevo, sem semáforos e sem pontos de ônibus**, nenhum deles mapeado no OSM.
- Os locais pedidos que não estão no OSM (Centro Poliesportivo, Ferreira Burguers, Casa de Pesca Avenida, igreja, escola, prefeitura) **não foram posicionados**.

Cobertura de 100 % aqui vale **só para os eixos das vias carroçáveis**. Não é uma afirmação sobre edificações, lotes nem sobre o que o OSM não mapeia.
