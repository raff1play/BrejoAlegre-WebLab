# Assets do protótipo

**Versão 0.1: nenhum arquivo de asset de terceiros.** Não há modelo 3D, textura, fonte ou áudio baixado.

- Geometria: primitivas e malhas geradas em código (`src/world/`, `src/features/`).
- Texturas: pintadas em canvas 2D na inicialização por `src/world/textures.ts` (asfalto, concreto, reboco, bloco cerâmico, telha, grama, chapa, porta, janela, grade, folhagem, placas, céu; desde a W009 também pedra canjiquinha, cobogó, ladrilho hidráulico, pedra portuguesa, intertravado, atlas de sombras de contato e panorama de reflexo em `src/world/materials.ts`). Código do próprio repositório, sem licença externa a rastrear.
- W009: moto, entregador, palmeiras, arbustos e vasos também são geometria procedural própria; nenhum arquivo externo foi adicionado.
- Textos das placas usam a fonte sans-serif do sistema do visitante.
- A "MERCEARIA DO BAIRRO" e a "R. PROVISÓRIA" são nomes inventados; não representam comércio nem rua reais.
- As referências de IA dos chats anteriores **não foram enviadas para o repositório**. O guia textual fica em `docs/VISUAL_DIRECTION.md`.
- `docs/evidence/*.jpg` são capturas reais do navegador geradas por `tests/e2e/play.cjs`; não são assets do jogo.

Ao adicionar assets, preencher:

| Arquivo | Origem/autor | Licença/comprovação | Bytes | Uso/otimizações |
|---|---|---|---:|---|

## Ícones originais do PWA

Os ícones abaixo foram criados especificamente para este protótipo por código, sem ativos de terceiros. Não se tratam de modelos 3D nem de imagens geradas para simular gameplay.

| Arquivo | Origem/autor | Licença/comprovação | Bytes | Uso/otimizações |
|---|---|---|---:|---|
| `public/icons/icon-192.png` | Arte geométrica original produzida para o Web Lab | Sem dependências de terceiros; ícone do próprio projeto | 9.500 | PNG indexado de 2 bits, 192×192 |
| `public/icons/icon-512.png` | Arte geométrica original produzida para o Web Lab | Sem dependências de terceiros; ícone do próprio projeto | 66.145 | PNG indexado de 2 bits, 512×512 |

## W011 — Dragão e som procedurais

- `src/features/easterEgg/dragonSurprise.ts`: malhas e texturas do dragão/fogo geradas no próprio navegador; autoria desta implementação; nenhum arquivo externo baixado.
- `src/features/easterEgg/dragonAudio.ts`: ruídos, osciladores e envelopes de som sintetizados via Web Audio; nenhuma gravação externa, sem licença de terceiros.
- Candidato externo **não incluído:** [Ashwing Drake Lite](https://literock-studios.itch.io/ashwing-drake-lite), Literock Studios, modelo grátis para uso em jogos; a redistribuição do asset isolado é restrita. Seu uso exigiria conferir a licença completa e obter os arquivos de maneira autorizada.
