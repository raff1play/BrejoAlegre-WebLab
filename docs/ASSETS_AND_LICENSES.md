# Política de assets e dados geográficos

- **Referências IA em `assets/visual_references_AI.jpg` são referências aspiracionais**. Não são screenshots da Godot/Babylon, nem modelos 3D aproveitáveis diretamente.
- Cada arte/modelo/textura/som adicionado a `public/assets/` deve registrar nome, fonte, criador, licença, alterações e tamanho em bytes no manifesto `public/assets/ASSET_MANIFEST.md`.
- É proibido reutilizar logos reais de Mercado Livre/Shopee/TRACKen ou insinuar parceria oficial sem licença. Para protótipo usar marcas fictícias.
- Não extrair mapas geográficos de imagens ou inventar nomes de ruas. Registrar fonte cartográfica, licença, data, método de transformação e limitações.
- Se usar OSM, verificar ODbL e atribuição aplicável antes de redistribuir dados, e testar malha viária em vez de assumir completude.
- Não adicionar assets pesados sem testar peso do bundle, VRAM e FPS no Android.
