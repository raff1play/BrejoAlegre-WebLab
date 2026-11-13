# Assets do protótipo

**Histórico W009:** o projeto começou sem assets externos. Desde CORE-011 há arquivos Poly Haven, e o teste Patch opcional abaixo.

- Geometria: primitivas e malhas geradas em código (`src/world/`, `src/features/`).
- Texturas: pintadas em canvas 2D na inicialização por `src/world/textures.ts` (asfalto, concreto, reboco, bloco cerâmico, telha, grama, chapa, porta, janela, grade, folhagem, placas, céu; desde a W009 também pedra canjiquinha, cobogó, ladrilho hidráulico, pedra portuguesa, intertravado, atlas de sombras de contato e panorama de reflexo em `src/world/materials.ts`). Código do próprio repositório, sem licença externa a rastrear.
- CORE-010: nenhum asset externo. Fontes pesquisáveis (patch.gg, Kenney, Quaternius, Poly Haven, ambientCG) estavam bloqueadas pela rede do ambiente (403); novas texturas procedurais: cartões de folhagem por espécie, placas de número (rua fictícia "R. Provisória"), céu com cúmulos, asfalto e telhas revisados.
- W009: moto, entregador, palmeiras, arbustos e vasos também são geometria procedural própria; nenhum arquivo externo foi adicionado.
- Textos das placas usam a fonte sans-serif do sistema do visitante.
- A "MERCEARIA DO BAIRRO" e a "R. PROVISÓRIA" são nomes inventados; não representam comércio nem rua reais.
- As referências de IA dos chats anteriores **não foram enviadas para o repositório**. O guia textual fica em `docs/VISUAL_DIRECTION.md`.
- `docs/evidence/*.jpg` são capturas reais do navegador geradas por `tests/e2e/play.cjs`; não são assets do jogo.

## CORE-011 — assets externos reais (12/11/2026)

Baixados pela API do Poly Haven (`api.polyhaven.com/files/<id>`, arquivos em `dl.polyhaven.org`), conferidos pelo MD5 publicado e otimizados com `@gltf-transform/cli` 4.5.1 (`optimize --compress false --texture-compress webp --texture-size 512 --simplify-ratio …`, rodado fora do projeto). Tudo CC0: sem atribuição obrigatória, autores registrados por cortesia.

| Arquivo (em `public/assets/`) | Origem / autor | Licença | Bytes | Uso / otimizações |
|---|---|---|---:|---|
| `models/street_lamp_01.glb` | Poly Haven — "Street Lamp 01", autor Josh Dean — https://polyhaven.com/a/street_lamp_01 | CC0 1.0 (https://polyhaven.com/license) | 117332 | Original glTF 1k: 30 610 triângulos, 2,17 MB. Simplificado para 2 046 triângulos; texturas WebP 512 px; materiais PBR convertidos em StandardMaterial no carregamento. Postes coloniais da vitrine. |
| `models/planter_box_02.glb` | Poly Haven — "Planter Box 02", autor James Ray Cock — https://polyhaven.com/a/planter_box_02 | CC0 1.0 (https://polyhaven.com/license) | 128096 | Original: 10 944 triângulos, 2,47 MB. Simplificado para 546 triângulos; WebP 512 px; cor clareada no motor. Caixas das floreiras (flores procedurais da CORE-010). |
| `models/rollershutter_door.glb` | Poly Haven — "Rollershutter Door", autor MP — https://polyhaven.com/a/rollershutter_door | CC0 1.0 (https://polyhaven.com/license) | 70936 | Original: 1 104 triângulos (duas variantes), 2,34 MB. Variante com pichação removida; 552 triângulos; WebP 512 px. Porta de enrolar fechada da mercearia. |
| `textures/clay_roof_tiles_03_diff_512.jpg` e `_nor_gl_512.jpg` | Poly Haven — "Clay Roof Tiles 03", autor Amal Kumar — https://polyhaven.com/a/clay_roof_tiles_03 | CC0 1.0 (https://polyhaven.com/license) | 159421 | Mapas 1k (cor e normal OpenGL) reduzidos para 512 px. Telha cerâmica de todos os telhados; mapa normal só no perfil alto; repetição real de 2,6 m. |

Fontes avaliadas e não usadas: Kenney (kenney.nl responde 403 a clientes automatizados, embora o proxy permita); ambientCG (API ok, mas downloads redirecionam para `acg-download.struffelproductions.com`, bloqueado); downloads diretos de arquivos CDN do patch.gg estavam bloqueados no ambiente antigo. No teste posterior os GLBs foram obtidos via CLI oficial `pch assets add` com licenças embutidas; árvores do Poly Haven (≈1,6 milhão de triângulos, inviáveis no celular).

Ao adicionar assets, preencher:

| Arquivo | Origem/autor | Licença/comprovação | Bytes | Uso/otimizações |
|---|---|---|---:|---|

## Ícones originais do PWA

Os ícones abaixo foram criados especificamente para este protótipo por código, sem ativos de terceiros. Não se tratam de modelos 3D nem de imagens geradas para simular gameplay.

| Arquivo | Origem/autor | Licença/comprovação | Bytes | Uso/otimizações |
|---|---|---|---:|---|
| `public/icons/icon-192.png` | Arte geométrica original produzida para o Web Lab | Sem dependências de terceiros; ícone do próprio projeto | 9.500 | PNG indexado de 2 bits, 192×192 |
| `public/icons/icon-512.png` | Arte geométrica original produzida para o Web Lab | Sem dependências de terceiros; ícone do próprio projeto | 66.145 | PNG indexado de 2 bits, 512×512 |



## Teste visual Patch.gg — ônibus e pedestre animada (13/11/2026)

**Não é troca definitiva.** Apenas `?assets=patch` carrega os modelos abaixo de forma assíncrona, com fallback para a apresentação CORE-014 se falharem. Sem a flag, nenhuma dessas malhas é requisitada, preservando o jogo e o FPS atuais. Rotas, regras e colisões continuam na simulação original. A experiência Android real não foi aferida.

| Arquivo | Origem / licença | Tamanho | Uso |
|---|---|---:|---|
| `models/patch/city-bus-49fd97.glb` | [City Bus — Polyfork](https://polyfork.dev/asset/city-bus-49fd97), via Patch `polyfork:city-bus-49fd97`, **CC BY 4.0** | 230864 B | Substitui somente a malha dos até dois ônibus NPC visíveis no modo de teste; 2008 triângulos, largura 2,18 m, altura 3,2 m, comprimento 11 m. Visual low-poly; qualidade em comparação ainda pendente de aprovação humana. |
| `models/patch/woman.glb` | [Animated Woman — Patch/anymove](https://patch.gg/create/toolbox/assets/anymove:woman), **CC0 1.0** | 6268508 B | Substitui visualmente **uma** pedestre próxima com Idle/Walk no modo de teste, mantendo toda IA da CORE-014. 1,70 m, 22 ossos, textura original 4K; muito pesado para substituir todos os NPCs. |
| `models/patch/CREDITS.md`, `models/patch/LICENSES/*` | Arquivos gerados pela CLI do Patch a partir dos registros de origem | — | Preservam a atribuição Polyfork e os textos das licenças. A mesma atribuição está visível no menu Sobre/Pausa. |

Modelos GLB validados por cabeçalho e inspeção de cenas/animações. Importação feita pela CLI oficial do Patch em GitHub Actions, sem credenciais ou assinatura nova. Materiais e malhas não foram modificados. **Próximo passo:** comparar visualmente no aparelho; otimizar a personagem antes de aumentar a densidade.
