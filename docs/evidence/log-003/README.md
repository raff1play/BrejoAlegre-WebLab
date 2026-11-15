# LOG-003 — Entrega técnica e evidências

15/11/2026 · branch `feat/art-001-primeira-loja-moto` · base `9805cf3` (ART-002 com piso corrigido, processamento imediato e relógio 150 s/h). Commits locais, sem publicação, sem merge em main/preview e sem alterações nessas branches.

## Resultado implementado

Uma jornada possui um inventário autoritativo de 21–55 IDs. O jogador e três motociclistas coletam em oito lojas, duas por pessoa. Os destinos determinam quatro setores, gaiolas e cargas. Um volume coletado pelo jogador pode ser entregue por um NPC e vice-versa. A van fictícia amarela abastece a D05 e seus volumes percorrem o mesmo recebimento/conferência/esteira/gaiola/doca.

A retirada é autorizada a partir das 15h conforme a carga fica pronta. Cada motociclista leva sua saca ao próprio baú. Uma confirmação libera a equipe; os NPCs partem com espaçamento de três segundos. Concluir o Oeste mantém a jornada ativa enquanto houver rotas pendentes. Às 21h volumes pendentes permanecem pendentes.

A chegada e a saída da van são **assistidas na D05**, com mudança explícita de estado e remoção após fechar as portas. **O percurso viário e a manobra da van não estão implementados.** Essa é a alternativa intermediária admitida pelo pedido; não representam uma viagem física completa.

## Arquitetura e circulação

[Planta operacional](base-circulation.svg) · [Mapa geográfico dos quatro setores](geographic-sectors.svg) · [Inspeção do mapa no navegador com toque](touch-sector-map.jpg).

- Portão existente de 12 m, entrada de motos em x local 103,5 e saída em 108,5. Curvas locais suavizadas; física do jogador preservada.
- Quatro vagas de 1,8 × 3,2 m. Moto decorativa removida; os três modelos adicionais representam entregadores operacionais.
- Passagem a pé preservada na lateral oeste e pelo acesso protegido da portaria; D01 liberada para Norte.
- D01 Norte / NPC1; D02 Oeste / jogador; D03 Leste / NPC2; D04 Sul / NPC3; D05 recebimento da van.
- Bancada com 12 posições e reserva de espaço para o descarregador. Sem espaço livre, a transferência aguarda; nenhum volume é descartado.
- Quatro gaiolas de 18 posições e quatro posições de carga, cada uma para até 18 volumes. A geração balanceada usa no máximo 14 por setor em um dia de 55; empilhamento cabe na estrutura.
- Geometria e colisões fixas continuam derivadas de `depotPlan.ts`; folhas do portão e porta D05 usam estado dinâmico. A altura livre da porta governa a passagem.
- Removida a antiga porta GLB estática que cobria a D05 mesmo quando a porta operacional abria. A evidência visual detectou essa sobreposição; o navegador agora verifica sua ausência.
- O recorte do terreno e as superfícies disjuntas do piso ART-002 foram preservados. As novas demarcações usam a camada de pintura com viés de profundidade.

`LogisticsDay` especializa `Workday` e usa o mesmo array `parcels` e a mesma instância `DepotOperations`. Inventários de NPCs são consultas por custodiante, não cópias. `Courier` guarda tarefas, posição e rota; a apresentação lê esses dados. `Workday` mantém compatibilidade com os testes do fluxo antigo. A geração de demanda, setores e rotas ficam em módulos puros.

Os três controladores de coleta avançam simultaneamente. Usam faixas do grafo, curvas de cruzamentos, sentidos permitidos, semáforos e parada em PARE. As recomendações usam distância pela rede e melhoria 2-opt limitada. Os NPCs fazem estacionamento, caminhada, retirada parcial, baú, retorno, descarga e entrega. Veículos ambientes recebem as motos como obstáculos e os motociclistas aguardam bloqueios próximos. A validação completa da jornada usa tráfego ambiente desligado; a interação prolongada com o tráfego normal ainda precisa de ensaio dedicado.

A demanda escolhe até cinco endereços candidatos por setor a cada dia; os volumes podem compartilhar parada. Todos os 48 endereços elegíveis permanecem no conjunto geográfico. Origem, coletor, destino, plataforma, setor, estado, localização, custodiante e histórico pertencem ao mesmo registro de pacote. Caixas no galpão e nas mãos dos NPCs usam instâncias e atlas de IDs; baús/sacas usam agrupamento com contagem explícita.

## Commits por etapa

| Etapa | Commit | Entrega |
|---|---|---|
| A | `84d0ec7` | Vagas, acessibilidade e identificação das quatro docas de expedição |
| B | `045f0c6` | Van amarela, portas funcionais, estado de descarga e porta D05 |
| C | `a7d5ebd` | Demanda semeada, oito lojas, atribuições exclusivas, coleta parcial |
| D | `5558a30` | Três entregadores simultâneos com rotas e ações físicas |
| E | `8dc2c90` | Quatro gaiolas, quatro cargas e armazenamento limitado |
| F | `c23e7a3` | Liberação conjunta, entregas autônomas e esteira em fluxo contínuo |
| G | commit final desta entrega | Painel, mapa, correções de navegação/porta, testes e evidências |

Typecheck executado nos commits A–F; a validação completa registrada abaixo corresponde ao resultado final. Refinamentos das etapas anteriores estão incluídos no commit G. Nenhuma dependência ou asset externo novo; a van é geometria original com identidade fictícia. Assets CC0 anteriores e suas licenças continuam no projeto.

## Capturas reais antes/depois

Chromium, perfil mobile, 960×540, mesmas poses, 11h30, tráfego desligado. “Corte” significa apenas cobertura removida para inspeção no jogo; não é imagem gerada.

| Cena | Antes (`9805cf3`) | Depois |
|---|---|---|
| Entrada / portaria | [Antes](before/entry.jpg) | [Depois](after/entry.jpg) |
| Vagas, pátio e piso | [Antes](before/parking-floor.jpg) | [Depois](after/parking-floor.jpg) |
| Galpão | [Antes](before/warehouse.jpg) | [Depois](after/warehouse.jpg) |
| Triagem (corte) | [Antes](before/sorting.jpg) | [Depois](after/sorting.jpg) |
| Cinco docas (corte) | [Antes](before/five-docks.jpg) | [Depois](after/five-docks.jpg) |

Operação observada: [recebimento com IDs](receiving-original-ids.jpg), [esteira](after-sorting-cutaway.jpg), [quatro gaiolas](four-regional-cages-cutaway.jpg), [volumes simultaneamente nas quatro docas corretas](four-loads-in-correct-docks.jpg), [van amarela](yellow-van-front.jpg), [portas abertas e descarga da van](yellow-van-unloading.jpg), [equipe pronta e botão de saída](logistics-panel-ready.jpg).

A foto das quatro docas mostra **cargas parciais em preparação**, antes das retiradas. Não afirma que todas as cargas completas ficaram simultaneamente armazenadas: NPCs podem retirar sua própria carga pronta a partir das 15h e aguardar com ela no baú. Os históricos registram a passagem de todos os volumes pela doca correta.

## Jornada reproduzível e distribuição

Seed 2026: 28 volumes das oito lojas + 15 da van = 43. Cargas por destino: Norte 11, Oeste 11, Leste 11, Sul 10. Plataformas ML/SHP aparecem misturadas em cada carga.

| Entregador | Setor / doca | Lojas | Volumes de coleta |
|---|---|---|---:|
| jogador | Oeste / D02 | Depósito de Construção + Farmácia Popular | 7 |
| npc1 | Norte / D01 | Padaria Pão Quente + Mercearia do Bairro | 7 |
| npc2 | Leste / D03 | Casa & Lar Variedades + Hortifruti da Praça | 10 |
| npc3 | Sul / D04 | Papelaria Central + Supermercado Boa Vista | 4 |

[CSV completo da seed 2026](seed-2026-packages.csv) · [CSV do mínimo natural de 21](seed-674161-packages.csv) · [CSV do máximo natural de 55](seed-357183-packages.csv).

| ID | Origem / coletor | Plataforma | Setor / doca | Endereço |
|---|---|---|---|---|
| J2026-001 | construcao / jogador | ML | Norte / D01 | Rua Quatro, 89 — Brejo Alegre |
| J2026-002 | construcao / jogador | ML | Oeste / D02 | Rua Nove de Julho, 230 — Brejo Alegre |
| J2026-003 | farmacia / jogador | ML | Leste / D03 | Rua Leopoldo Cubas, 29 — Brejo Alegre |
| J2026-004 | farmacia / jogador | ML | Sul / D04 | Rua Coroados, 328 — Centro |
| J2026-005 | farmacia / jogador | SHP | Norte / D01 | Rua das Nações, 249 — Centro |
| J2026-006 | farmacia / jogador | SHP | Oeste / D02 | Rua das Palmeiras, 585 — Brejo Alegre |
| J2026-007 | farmacia / jogador | SHP | Leste / D03 | Rua Leopoldo Cubas, 29 — Brejo Alegre |
| J2026-008 | padaria / npc1 | SHP | Sul / D04 | Rua Coroados, 328 — Centro |
| J2026-009 | padaria / npc1 | ML | Norte / D01 | Rua das Palmeiras, 105 — Brejo Alegre |
| J2026-010 | padaria / npc1 | ML | Oeste / D02 | Rua Oito de Julho, 382 — Centro |
| J2026-011 | padaria / npc1 | ML | Leste / D03 | Rua Treze de Maio, 317 — Brejo Alegre |
| J2026-012 | padaria / npc1 | ML | Sul / D04 | Rua Santos Dumont, 444 — Brejo Alegre |
| J2026-013 | mercearia / npc1 | SHP | Norte / D01 | Rua Treze de Maio, 18 — Brejo Alegre |
| J2026-014 | mercearia / npc1 | SHP | Oeste / D02 | Rua Oito de Julho, 382 — Centro |
| J2026-015 | variedades / npc2 | SHP | Leste / D03 | Rua Dois, 420 — Brejo Alegre |
| J2026-016 | variedades / npc2 | SHP | Sul / D04 | Rua Santos Dumont, 444 — Brejo Alegre |
| J2026-017 | variedades / npc2 | ML | Norte / D01 | Rua das Nações, 249 — Centro |
| J2026-018 | variedades / npc2 | ML | Oeste / D02 | Rua das Palmeiras, 585 — Brejo Alegre |
| J2026-019 | variedades / npc2 | ML | Leste / D03 | Rua Treze de Maio, 317 — Brejo Alegre |
| J2026-020 | hortifruti / npc2 | ML | Sul / D04 | Rua Santos Dumont, 306 — Brejo Alegre |
| J2026-021 | hortifruti / npc2 | SHP | Norte / D01 | Rua Treze de Maio, 18 — Brejo Alegre |
| J2026-022 | hortifruti / npc2 | SHP | Oeste / D02 | Rua Oito de Julho, 382 — Centro |
| J2026-023 | hortifruti / npc2 | SHP | Leste / D03 | Rua Leopoldo Cubas, 29 — Brejo Alegre |
| J2026-024 | hortifruti / npc2 | SHP | Sul / D04 | Rua Santos Dumont, 306 — Brejo Alegre |
| J2026-025 | papelaria / npc3 | ML | Norte / D01 | Rua das Nações, 249 — Centro |
| J2026-026 | papelaria / npc3 | ML | Oeste / D02 | Rua das Palmeiras, 585 — Brejo Alegre |
| J2026-027 | supermercado / npc3 | ML | Leste / D03 | Rua Dois, 278 — Brejo Alegre |
| J2026-028 | supermercado / npc3 | ML | Sul / D04 | Rua Santos Dumont, 306 — Brejo Alegre |
| J2026-029 | CD-VAN / motorista | SHP | Norte / D01 | Rua das Palmeiras, 105 — Brejo Alegre |
| J2026-030 | CD-VAN / motorista | SHP | Oeste / D02 | Rua das Palmeiras, 269 — Brejo Alegre |
| J2026-031 | CD-VAN / motorista | SHP | Leste / D03 | Rua Dois, 278 — Brejo Alegre |
| J2026-032 | CD-VAN / motorista | SHP | Sul / D04 | Rua Santos Dumont, 306 — Brejo Alegre |
| J2026-033 | CD-VAN / motorista | ML | Norte / D01 | Rua das Nações, 249 — Centro |
| J2026-034 | CD-VAN / motorista | ML | Oeste / D02 | Rua das Palmeiras, 585 — Brejo Alegre |
| J2026-035 | CD-VAN / motorista | ML | Leste / D03 | Rua Dois, 420 — Brejo Alegre |
| J2026-036 | CD-VAN / motorista | ML | Sul / D04 | Rua Leopoldo Cubas, 267 — Brejo Alegre |
| J2026-037 | CD-VAN / motorista | SHP | Norte / D01 | Rua Quatro, 89 — Brejo Alegre |
| J2026-038 | CD-VAN / motorista | SHP | Oeste / D02 | Rua Oito de Julho, 382 — Centro |
| J2026-039 | CD-VAN / motorista | SHP | Leste / D03 | Rua Santos Dumont, 222 — Brejo Alegre |
| J2026-040 | CD-VAN / motorista | SHP | Sul / D04 | Rua Santos Dumont, 444 — Brejo Alegre |
| J2026-041 | CD-VAN / motorista | ML | Norte / D01 | Rua Treze de Maio, 18 — Brejo Alegre |
| J2026-042 | CD-VAN / motorista | ML | Oeste / D02 | Rua das Palmeiras, 585 — Brejo Alegre |
| J2026-043 | CD-VAN / motorista | ML | Leste / D03 | Rua Dois, 278 — Brejo Alegre |

## Custódia verificável

[Três históricos completos](custody-examples.json) · [Estado real do navegador e históricos de todos os volumes](browser-operation.json) · [Cargas antes da retirada do jogador](four-loads-before-player-pickup.json).

- `J2026-001`: coletado pelo **jogador** no Depósito de Construção; destino **Norte**; percorre recebimento → conferência → transferência → triagem → gaiola Norte → D01/ROTA-N → mãos/baú do **NPC1** → destinatário.
- `J2026-008`: coletado pelo **NPC1** na Padaria; destino **Sul**; mesmo fluxo físico até D04/ROTA-S → mãos/baú do **NPC3** → destinatário.
- `J2026-029`: abastecimento da **van**, chega à D05 no mesmo ID; descarregador → recebimento/conferência/triagem → gaiola Norte → D01/ROTA-N → **NPC1** → destinatário.

Cada JSON contém eventos com operação, horário, custodiante, estado, local, posição e carga/doca. Interpolação de posição durante transporte não cria outro pacote. A chegada da van conserva o ID original; retirar uma carga move seus registros em vez de gerar substitutos.

## Testes e resultados

- `npm run validate:repo`: passou (28 documentos obrigatórios).
- `npm run test:unit`: **137/137 passaram**. Inclui testes anteriores, 12 de demanda, 3 de acesso/van e 8 de operação/salto de relógio.
- `npm run typecheck`: passou.
- `npm run build:staging`: passou; permanece o aviso de bundle principal acima de 1.500 kB.
- `npm run test:e2e`: jornada real no Chromium e controles por toque emulado. Resultados em [log E2E](e2e.log), [JSON da operação](browser-operation.json) e [JSON touch](touch-browser.json).
- [Log de checks/build](checks.log). O teste antigo de navegador ficou disponível como `test:e2e:legacy` para a baseline, pois pressupõe oito volumes e uma única rota; não é a aceitação da LOG-003.

Cobertura inclui: oito lojas sem duplicação, 2–5 volumes por loja, van 5–15, total/IDs únicos, coleta parcial de cinco volumes, coletas NPC simultâneas, visitas de descarga inválidas/moto em movimento, recebimento e conferência antes das 13h, retirada antecipada/na doca errada, quatro cargas mistas, entrega única, continuidade após o jogador concluir, saltos de relógio sem processamento fictício, portas/portão, caminhos e conservação de IDs/histórico. As rotas entre lojas e as curvas das quatro vagas foram amostradas contra os obstáculos reais.

Replays completos usam seeds 1, 2, 2026, 9987 e os extremos **naturais** 674161/357183, além de fixtures de fronteira. Tabela abaixo vem dos replays puros, com posições do jogador em visitas válidas, sem contabilizar suas viagens manuais pela cidade. É teste de conservação/fluxo, não promessa de tempo de conclusão de um jogador real.

| Seed | Volumes | Liberação conjunta | Último retorno à moto | Resultado |
|---|---:|---|---|---|
| 2026 | 43 | 16:35 | 19:52 | CONCLUIDA, IDs conservados |
| 674161 | 21 | 15:34 | 18:16 | CONCLUIDA, IDs conservados |
| 357183 | 55 | 17:23 | 20:55 | CONCLUIDA, IDs conservados |

[Replay 2026](seed-2026.json) · [Replay mínimo](seed-674161.json) · [Replay máximo](seed-357183.json).

O navegador usa controles reais para o teste do portão e interações reais de coleta, baú, recebimento, carga e entrega. Viagens do **jogador** entre lojas/endereços e caminhadas longas usam reposicionamento de teste. Passos limitados de simulação aceleram a execução headless sem editar pacotes. Viagens dos **NPCs** são executadas pelo controlador normal em suas rotas. Não declarar que esse ensaio dirigiu manualmente toda a jornada.

## Desempenho e avaliação crítica

[Métricas, método e limites](performance.md) · [amostras antes](before/metrics.json) · [amostras depois](after/metrics.json).

O avanço funcional é significativo: quatro pessoas, oito lojas, estoques por setor e entregas finais compartilham custódia e IDs. O galpão aproveita a arquitetura ART-002; a transformação desta etapa se concentra em circulação, quatro gaiolas/docas e operação conjunta, com van própria. A cena continua estilizada e simples. Materiais, animações de manuseio, detalhes construtivos e acabamento não atingem uma referência urbana artística de alta qualidade.

Limitações restantes:

1. Van com chegada/saída assistidas; falta percurso de rua, manobra física e saída dirigidos pelo grafo.
2. NPCs usam movimento cinemático por caminhos; manuseio, alcance das mãos e transição para o banco são simplificados. Não há solução completa de desvio entre funcionários ou reserva de cruzamento compartilhada com todos os veículos.
3. A jornada completa foi validada com tráfego ambiente desligado. Interação com tráfego normal tem bloqueios integrados, mas precisa de ensaio prolongado; não afirmar ausência de todo impasse possível.
4. O caso natural de 55 volumes termina perto das 21h no replay. Tempo do jogador, tráfego e esperas podem deixar pendências, que permanecem registradas.
5. Métricas de cenas paradas em SwiftShader não comprovam fluidez sob carga no Android. Galaxy S24, temperatura, bateria e conforto de manobra no aparelho **não testados**.
6. A câmera deixou de ser tapada pelo letreiro sobre as vagas, mas o ensaio completo de manobras por toque em aparelho real ainda falta.

Portanto: a operação principal está implementada e testada nos métodos descritos; a etapa não representa uma simulação veicular completa da van, homologação de tráfego normal, aprovação artística ou aceite Android.

## Arquivos

Código e configuração modificados desde a base:

- `package.json`
- `src/core/city/traffic.ts`
- `src/core/delivery/courierRoutes.ts`
- `src/core/delivery/couriers.ts`
- `src/core/delivery/dailyDemand.ts`
- `src/core/delivery/depotOperations.ts`
- `src/core/delivery/logisticsDay.ts`
- `src/core/delivery/parcels.ts`
- `src/core/delivery/sectors.ts`
- `src/core/delivery/supplierVan.ts`
- `src/core/delivery/workday.ts`
- `src/features/city/cityLife.ts`
- `src/features/delivery/courierViews.ts`
- `src/features/delivery/deliveryGame.ts`
- `src/features/delivery/depotParcels.ts`
- `src/features/delivery/supplierVanView.ts`
- `src/features/driving/motorcycle.ts`
- `src/features/hud/logisticsPanel.ts`
- `src/main.ts`
- `src/style.css`
- `src/world/city/depotArchitecture.ts`
- `src/world/city/depotPlan.ts`
- `src/world/externalAssets.ts`
- `tests/log003-access.test.ts`
- `tests/log003-demand.test.ts`
- `tests/log003-operation.test.ts`

Scripts de reprodução: `scripts/log003/browser.cjs`, `touch.cjs`, `compare.cjs`, `export.mjs`, `performance.mjs`. Evidências e tabelas neste diretório. Documentação atualizada em PROJECT_STATE, DECISIONS, ARCHITECTURE e ISSUES_AND_RISKS.
