# Desempenho observado — LOG-003

Chromium 156.0.8078.79; SwiftShader (GPU por software), perfil mobile, 960×540, escala 1, tráfego desligado, 11h30. Mesmas cinco poses: true. 30 quadros renderizados por cena, após 1,8 s de aquecimento. Baseline arquivada: `9805cf3`. Pausa ativa com painel oculto para congelar a mesma cena. Cortes de cobertura assinalados nas poses.

| Cena | Draw calls médios antes → depois | Triângulos antes → depois | Quadro instrumentado ms antes → depois | FPS observado antes → depois |
|---|---:|---:|---:|---:|
| entry | 376.0 → 407.0 | 504863 → 524485 | 36.4 → 47.2 | 2.85 → 2.45 |
| parking-floor | 374.0 → 405.0 | 511685 → 531849 | 9.0 → 8.9 | 5.23 → 4.62 |
| warehouse | 346.0 → 377.0 | 496463 → 516085 | 9.2 → 8.2 | 5.64 → 4.99 |
| sorting | 246.0 → 252.0 | 462761 → 453805 | 8.0 → 6.9 | 5.94 → 5.74 |
| five-docks | 380.0 → 411.0 | 516673 → 536295 | 8.5 → 8.0 | 5.32 → 5.10 |

Essas medições descrevem cenas paradas deste Chromium em software. O FPS observado, baixo neste ambiente, inclui renderização por software e sincronização; o contador interno de tempo de quadro não equivale ao intervalo total entre quadros. Não converter os tempos instrumentados em FPS de aparelho. Não são medições da operação inteira em movimento, de temperatura, bateria ou Android físico.

As contagens incluem cenário vizinho, sombras e NPCs vistos pela câmera. O aumento de complexidade em algumas poses é real; não declarar ganho de desempenho a partir de outras poses ou de tempos sujeitos à carga do host. A meta de 30 FPS no aparelho real permanece sem comprovação. Amostras brutas, resolução, poses e erros constam em before/metrics.json e after/metrics.json.

Reprodução: extrair git archive 9805cf3 em diretório isolado, dependências locais disponíveis, servidor da baseline em 5175 e servidor atual em 5173; node scripts/log003/compare.cjs; node scripts/log003/performance.mjs. ONLY_VERSION=after permite repetir somente a versão atual. Não trocar/criar branches para comparar.
