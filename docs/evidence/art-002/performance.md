# Performance observada — ART-002

Chromium 156.0.8078.79, SwiftShader (GPU por software), 1280×720, perfil desktop, tráfego desligado, hora inicial 12h30. Doze quadros renderizados por câmera. Poses idênticas: true. Antes: ART-001 3931aa2. Depois: ART-002 final. As séries comparativas foram capturadas separadamente dos testes de navegador.

| Cena | Triângulos antes → depois | Draw calls médios antes → depois | Malhas ativas antes → depois |
|---|---:|---:|---:|
| entrada | 597233 → 623995 | 1177.0 → 1179.0 | 580 → 581 |
| patio | 570241 → 597003 | 938.0 → 940.0 | 244 → 245 |
| galpao | 556259 → 582229 | 830.3 → 828.3 | 134 → 131 |
| triagem | 547649 → 577857 | 1103.0 → 1096.0 | 502 → 502 |
| docas | 562045 → 588017 | 1127.0 → 1126.0 | 536 → 534 |

Os dados completos (frameMs, renderMs, memória JS e contagens) estão nos JSONs. Os tempos de software dependem da carga da máquina; não são FPS de Android e não sustentam promessa de 30 FPS. As contagens incluem a cidade visível e os passes de sombra, não apenas o galpão. Pequenas oscilações de NPCs/streaming devem ser consideradas.

O depósito inicial está vazio às 12h30. As capturas de operação em `operation/` comprovam carga real, mas não são a mesma cena estática desta tabela. Caixas ativas usam um batch com thin instances e um atlas de IDs (dois grupos de renderização); grupos vazios ou distantes são desativados. NPCs distantes suspendem a apresentação e mantêm sua posição/custódia no controlador. Nenhuma luz dinâmica por pacote ou dependência nova.
