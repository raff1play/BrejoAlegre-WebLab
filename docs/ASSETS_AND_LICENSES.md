# Política de assets e dados geográficos

- **Referências visuais IA:** as imagens geradas em chats anteriores **não foram versionadas nesta branch**. Não afirmar que `docs/assets/visual_references_AI.jpg` existe. O contrato textual válido está em `docs/VISUAL_DIRECTION.md`. Se as imagens forem anexadas no futuro, registrar a proveniência; imagens de IA não são screenshots do Babylon nem modelos 3D utilizáveis diretamente.
- Cada arte/modelo/textura/som adicionado a `public/assets/` deve registrar nome, fonte, criador, licença, alterações e tamanho em bytes no manifesto `public/assets/ASSET_MANIFEST.md`.
- É proibido reutilizar logos reais de Mercado Livre/Shopee/TRACKen ou insinuar parceria oficial sem licença. Para protótipo usar marcas fictícias.
- Não extrair mapas geográficos de imagens ou inventar nomes de ruas. Registrar fonte cartográfica, licença, data, método de transformação e limitações.
- Se usar OSM, verificar ODbL e atribuição aplicável antes de redistribuir dados, e testar malha viária em vez de assumir completude.
- Não adicionar assets pesados sem testar peso do bundle, VRAM e FPS no Android.

## CORE-014 (13/11/2026)

Nenhum asset externo novo. Veículos NPC, pessoas (funcionários, clientes, transeuntes), interiores das lojas, galpão, placas de número (atlas de dígitos desenhado em canvas) e mobiliário são **procedurais**, gerados no código (`src/features/city/vehicleModels.ts`, `src/features/shared/character.ts`, `src/world/city/cityBuild.ts`). Os assets CC0 da CORE-011 (Poly Haven) continuam como estavam. Fontes externas de modelos (Kenney, Quaternius, ambientCG) não foram consultadas nesta sessão; substituições futuras exigem registro de fonte, autor, licença e tamanho aqui.

## CORE-015 (13/11/2026) — dados geográficos

- **OpenStreetMap**, recorte da sede de Brejo Alegre/SP: `data/osm/brejo-alegre.raw.json` e o derivado `src/world/geo/brejoAlegreData.ts`. Licença **ODbL 1.0**, atribuição "© OpenStreetMap contributors" (https://www.openstreetmap.org/copyright). Extraído em 13/11/2026 pela Overpass API, com procedência em `data/osm/SOURCE.json`.
- **Obrigações:**
  - manter a atribuição visível no jogo (tela Pausa/Sobre) e nos arquivos derivados;
  - distribuir o banco derivado (a rede e as quadras geradas) sob ODbL, ou oferecer o método de reprodução (os scripts em `scripts/geo/` reproduzem tudo a partir do bruto);
  - não alegar endosso do OSM.
- As imagens do jogo são uma "Produced Work" e precisam da atribuição.
- Nenhum dado do Google Maps foi usado.
- O experimento Patch.gg foi removido; seus GLBs e licenças saíram do repositório. Os assets CC0 Poly Haven (CORE-011) continuam.

## ART-001 (14/11/2026)

Arte original implementada em `src/world/city/firstPickupArt.ts` e na apresentação da moto do jogador (`src/features/driving/motorcycle.ts`). Letreiro e identidade fictícia BREJO ENTREGAS desenhados em canvas; geometrias montadas no motor. Sem download ou novo asset de terceiros, fonte comercial externa, imagem de IA ou dependência nova. As capturas em `docs/evidence/art-001/` são renders reais do Babylon/Chromium; preservada a atribuição dos dados OSM do projeto. A referência pictórica exata não foi anexada nesta tarefa.
