# Custo observado da cena

Chromium 156.0.8078.79, 1280×720, perfil desktop, SwiftShader, tráfego desligado. 30 quadros reais por câmera. Poses iguais: true.

| Cena | Triângulos antes → depois | Draw calls médios antes → depois | Malhas ativas antes → depois |
|---|---:|---:|---:|
| shop | 716771 → 749723 | 2171.6 → 2181.6 | 952 → 957 |
| street | 728271 → 761223 | 2520.0 → 2530.0 | 1074 → 1079 |
| bike | 706955 → 739907 | 2418.0 → 2428.0 | 959 → 964 |
| interior | 682215 → 708617 | 2325.0 → 2331.0 | 784 → 785 |

Os JSONs preservam tempos brutos de quadro/render e memória JS. A série final posterior foi capturada sem o E2E concorrente. Tempos de software continuam sensíveis à carga da máquina; não usar seu delta como regressão de hardware nem converter para FPS de celular. A comparação acima mede complexidade renderizada, incluindo cenário e sombras, não só os objetos editados. Streaming e atividade de NPCs podem alterar pequenas contagens. Nenhuma conclusão de fluidez, temperatura ou bateria em Android físico.
