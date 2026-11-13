# Auditoria visual CORE-012 × CORE-013 × CORE-014

Capturas reais do Babylon.js em Chromium headless (GPU por software), 1280×720, mesmas posições quando possível. Referência: commit CORE-012 `bf8881e5`. Arquivos em `docs/evidence/core014-*.jpg` (antes/depois) e `core013-*.jpg`.

## O que a CORE-013 introduziu abaixo do padrão CORE-012

| Elemento | Problema encontrado (CORE-013) | Substituição na CORE-014 |
|---|---|---|
| Veículos NPC | Caixas sobrepostas ("brinquedo de blocos") | Perfis extrudados (capô, para-brisa inclinado, teto, traseira), vidros, colunas, para-choques, grade, retrovisores, placas, faróis/lanternas, pneus com aro (`src/features/city/vehicleModels.ts`) |
| Pedestres | Cubos (tronco, cabeça, pernas) | Perto: personagem articulado com IK e skinning na GPU (mesmo do entregador CORE-009/012), com cabelo, rosto, boné, avental; longe: figura afunilada com ombros, braços e cabeça arredondada (LOD) |
| Lojas novas | Fachada chapada, vidro opaco, sem interior | Prédio oco: vitrine transparente, porta central, pilares, platibanda, porta de enrolar animada, piso, balcão com caixa, prateleiras com produtos, porta de estoque, luminárias |
| Galpão | Bloco fechado e liso | Galpão oco: base de concreto, telha metálica, faixa de iluminação zenital, docas com portas recolhidas, para-choques e luz, portaria, porta de pessoal, interior com pilares, porta-paletes, esteira de triagem, mesas de recebimento/expedição, gaiolas, sala de controle e iluminação industrial |
| Muros de testada | Placa lisa | Reboco com rodapé de pedra, capeamento e pilares a cada ~3,2 m |
| Quadras | Gramado vazio | 20 casas novas (mesmo construtor das casas W009), praça, campinho; números das casas em placas esmaltadas |
| Entrada do galpão | Faixa de grama entre rua e portão | Rampa de concreto |

## Comparação (avaliação técnica; aprovação estética depende de avaliação humana)

- **Escala:** casas, lojas, veículos e pessoas usam medidas reais (carro 4,2 × 1,8 m; van 5,2 m; ônibus 11 m; pessoa ~1,75 m; lote 12 × 20 m).
- **Materiais:** os mesmos da CORE-010/011 (reboco texturizado, telha cerâmica fotográfica CC0, chapa ondulada, pinturas com tom por vértice); vidro de vitrine novo (transparente).
- **Iluminação:** sem mudanças no grade de cor da CORE-010; ciclo dia/noite da CORE-013 preservado.
- **Limites conhecidos:** fachadas laterais das lojas ainda simples; piso interno sem textura; produtos das prateleiras são volumes coloridos; NPCs distantes continuam simplificados (LOD); sem modelos externos novos (fontes externas não verificadas nesta sessão). Ver `docs/ISSUES_AND_RISKS.md` (C14-*).
