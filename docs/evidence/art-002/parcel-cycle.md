# Ciclo verificável — BA-0001

Fonte: `operation/trace.json`, jogo real em Chromium, fixture de dez volumes. Não foram substituídos os IDs. O cenário usa teleporte para deslocamentos longos e passos limitados da simulação para registrar a operação no headless. A caminhada e a descarga em duas viagens foram testadas separadamente por controles reais (`physical-walk.txt`).

| Evento | Estado | Localização | Custodiante | Posição local (m) |
|---|---|---|---|---|
| criado | NA_LOJA | loja | construcao | agrupamento jogador/veículo/loja |
| estado:COLETADO | COLETADO | loja | jogador | agrupamento jogador/veículo/loja |
| transferência:maos | COLETADO | maos | jogador | agrupamento jogador/veículo/loja |
| estado:EM_TRANSPORTE | EM_TRANSPORTE | maos | jogador | agrupamento jogador/veículo/loja |
| transferência:bau | EM_TRANSPORTE | bau | jogador | agrupamento jogador/veículo/loja |
| transferência:maos | EM_TRANSPORTE | maos | jogador | agrupamento jogador/veículo/loja |
| transferência:recebimento | EM_TRANSPORTE | recebimento | recebimento | 99.55, 0.95, -122.30 |
| transferência:conferencia | EM_TRANSPORTE | conferencia | conferente | 99.55, 0.95, -122.30 |
| estado:RECEBIDO_BASE | RECEBIDO_BASE | conferencia | conferente | 99.55, 0.95, -122.30 |
| transferência:transferencia | RECEBIDO_BASE | transferencia | descarregador-2 | 99.55, 0.95, -122.30 |
| transferência:triagem | RECEBIDO_BASE | triagem | separador-1 | 105.70, 0.93, -129.60 |
| estado:TRIADO | TRIADO | triagem | separador-1 | 116.30, 0.93, -129.60 |
| transferência:transferencia | TRIADO | transferencia | separador-2 | 116.30, 0.93, -129.60 |
| transferência:gaiola | TRIADO | gaiola | gaiola:Brejo Alegre | 124.35, 0.25, -136.20 |
| transferência:transferencia | TRIADO | transferencia | expedidor | 124.35, 0.25, -136.20 |
| transferência:doca | TRIADO | doca | expedidor | 103.30, 0.46, -119.80 |
| estado:NA_SACA | NA_SACA | doca | expedidor | 103.30, 0.46, -119.80 |
| transferência:saca | NA_SACA | saca | expedidor | 103.30, 0.46, -119.80 |
| estado:EM_ROTA | EM_ROTA | saca | jogador | 103.30, 0.46, -119.80 |
| transferência:maos | EM_ROTA | maos | jogador | agrupamento jogador/veículo/loja |
| transferência:bau | EM_ROTA | bau | jogador | agrupamento jogador/veículo/loja |
| transferência:maos | EM_ROTA | maos | jogador | agrupamento jogador/veículo/loja |
| estado:ENTREGUE | ENTREGUE | maos | destinatario | agrupamento jogador/veículo/loja |
| transferência:destinatario | ENTREGUE | destinatario | destinatario | agrupamento jogador/veículo/loja |

A doca atribuída é D02 e a carga é ROTA-01. O registro final continua BA-0001, entregue ao destinatário. O JSON inclui o histórico completo dos dez IDs, suas plataformas, regiões e os snapshots intermediários do BA-0001.
