# B1-01 — Contratos de integração com B1-02 a B1-09

**Status:** alinhamento técnico de dependências concluído para planejamento. **Não é implementação do B1-01 nem revisão das 17 decisões/26 critérios congelados.**  
**Base de análise:** código da `preview` auditado em 15/11/2026; `docs/BETA_1_0_SPEC.md`, `docs/BETA_1_0_DECISIONS.md` e `docs/beta1/STATE.json`.  
**Estado verificável:** B1-00 `APROVADO`; B1-01 `PENDENTE`. A autorização recebida foi para **esta etapa de alinhamento**, não para programar o B1-01, mudar o estado para EM_DESENVOLVIMENTO ou publicar gameplay.

## 1. Resultado do alinhamento

**Nenhuma nova decisão de produto é necessária para começar a arquitetura do B1-01.** O módulo deve cumprir integralmente as 17 decisões e AC-01 a AC-26. O carro com **ciclo logístico completo**, porta-malas abrível, caixas individuais visíveis, limites físicos e organização automática **é parte do B1-01**, não uma promessa para o B1-05. Retornos frustrados exigem devolução física + conferência, não geram remuneração. Os quatro entregadores continuam após 21h, com plantão mínimo na base e atraso individual.

As interfaces abaixo são **propostas técnicas executáveis** para evitar implementação duplicada e são ajustáveis por engenharia se preservarem as regras congeladas. Não autorizam introduzir novas regras de jogabilidade.

## 2. Auditoria do estado atual e do que precisa mudar

| Contrato | Evidência no código atual | Trabalho obrigatório antes do aceite B1-01 |
|---|---|---|
| Identidade estável de carreira e setor | `src/core/delivery/sectors.ts`: `SECTOR_DATA` vincula Oeste ao `jogador`; `src/core/delivery/logisticsDay.ts` retorna Oeste para `actor==='jogador'`; `dailyDemand.ts` usa `jogador/npc1/npc2/npc3` | Separar **ID persistente de personagem/carreira** do **papel temporário jogador/NPC**; permitir jogar em qualquer um dos quatro setores sem duplicar o personagem ativo entre os NPCs |
| Casas e começo do dia | `src/main.ts` nasce na base com moto; `src/core/city/clock.ts` inicia às 11h45 | Reservar quatro IDs/locais de casa, com âncoras navegáveis e vínculo por personagem; respeitar o requisito de preparação às **11h30**. Interiores/rotina doméstica elaborados ficam para B1-02 |
| Loja/demanda | `dailyDemand.ts` divide oito lojas em duas por ator; `logisticsDay.ts` anuncia oito lojas | Manter o **provedor de lojas e atribuições extensível** a 12 lojas no B1-03, sem cadastrar lojas fictícias extras agora; não gravar o número oito em snapshots ou regras de carreira |
| Carro jogável/controles | `src/main.ts` cria uma `Motorcycle`; `DeliveryGame.action`, `BikeSpot`, `DepotVisit` e `Workday.stow` assumem moto/baú | Introduzir **veículo ativo neutro** (moto/carro), posição de acesso à carga, colisão, estacionamento, entrada/saída e interação; não copiar a lógica de pacote inteira para classe Carro |
| Pacote/custódia | `parcels.ts` define `state/place/holder/position/history`; lugar móvel é `bau`; estado final único `ENTREGUE` | Fonte única de verdade por ID; representar compartimento do veículo, encaixe físico/visual por caixa, tentativa frustrada, devolução e conferência **não remunerada** sem retroceder a custódia |
| Base e expedição | `depotOperations.ts` é controlador único de tarefas; `workday.ts` e `logisticsDay.ts` exigem visita/estacionamento na moto | Reutilizar pipeline existente, adaptar geometria/visita para carro, manter separação por quatro setores e conferir devoluções em plantão após 21h sem teleporte de pacotes |
| Horário e equipe | `clock.ts` volta a 00h; `logisticsDay.ts` bloqueia retirada/entrega/liberação e encerra às 21h; `couriers.ts` e `depotOperations.ts` param às 21h; `logisticsPanel.ts` também desabilita liberação | Relógio **monotônico por jornada**; 21h como prazo de atraso, **não como fim obrigatório**; não parar NPCs, expedição, conferência, HUD ou rotas na madrugada; plantão mínimo e atrasos de cada ator |
| Checkpoints | `src/main.ts` persiste principalmente `CALENDAR_STORAGE_KEY` em `localStorage` | Snapshot versionado por carreira, backup exportável/restaurável, pontos seguros, operações idempotentes e restauração do mundo; migrar dados antigos sem apagar silenciosamente o calendário existente |
| Conclusão | `workday.ts` define `CONCLUIDA/ENCERRADA` e marca conclusão pela entrega; `main.ts` libera avançar o dia com esses estados | Só considerar resolvida uma operação com resultado final válido para **todos os pacotes dos quatro atores**; bloquear troca com pendências, reservar fase de retorno/encerramento para B1-09 e jamais avançar calendário automaticamente às 21h |

## 3. Cinco contratos compartilhados (somente engenharia)

### C1 — Identidades e carreira

**Separar duas identidades:** `careerId`/personagem é persistente (um dos quatro); `simulationActorId` indica o papel no expediente ativo (`jogador`, `npc1`, `npc2`, `npc3`). No começo de cada carreira, mapear **um e somente um** personagem ao jogador e os outros três aos NPCs, mantendo casas e setores fixos. Não criar uma quinta pessoa nem permitir que o jogador exista simultaneamente como NPC. Eventos e pagamentos da carreira inativa não devem ser gravados em seus saves.

**Forma proposta de dados:** `CareerProfile{careerId,characterPreset,appearancePreset,equipment,homeId,sectorId,ownedVehicleId,selectedVehicleKind,balance,calendarIndex,activeShiftId?,snapshotVersion}`. Um `VehicleId` é da carreira; o veículo inicial continua próprio/quitado e fixo. Os nomes/cores e marcas exatas não precisam ser fechados agora.

**Integração futura:** B1-02 fornece interiores das quatro casas ligadas a `homeId`; B1-03 calcula atribuições por distância real da casa; B1-09 usa a mesma casa para retorno e avanço do dia, sem redefinir IDs.

### C2 — Inventário único, carga física e resultados

**Uma fonte de verdade:** `Parcel` lógico com ID estável, status/resultado, detentor, localização/compartimento físico e histórico imutável. Visual 3D renderiza esse estado; não mantém um segundo inventário próprio. Proposta de separação: `ParcelOutcome` distingue `PENDENTE`, `ENTREGUE` e `DEVOLVIDO_E_CONFERIDO`. Uma tentativa registrada sem devolução + conferência continua pendente. Não substituir indevidamente `ENTREGUE` por devolução, nem contar devolução como pagamento.

**Carro neste B1-01:** abrir porta-malas, apresentar **cada volume individualmente**, escolher automaticamente posições reais de encaixe por dimensões/capacidade, rejeitar itens sem encaixe/capacidade e preservar custódia de volumes recusados. Colocar/retirar carrega a mesma transição lógica e o mesmo ID. Guardar posições e configuração de carga no checkpoint. **Não exigir organização manual** (Q15).

**B1-05 depois:** expandir classes de tamanho/peso e organização da **moto** (mãos até limite condicionado a peso/tamanho, baú, alforjes e carga externa), reaproveitando a mesma entidade e algoritmo de validação física. Não remover ou adiar a carga avançada do carro.

### C3 — Base, expedição e operação noturna

**Pipeline único:** loja -> mãos -> veículo -> recebimento físico -> conferência -> triagem -> saca/setor -> veículo -> destinatário OU tentativa -> veículo -> devolução física -> conferência. `DepotOperations` coordena tarefas, estado/posição e trabalhadores; `DeliveryGame` apenas exibe/interage com ações validadas pelo domínio. Cada operação tem ID/evento único e a transição de custódia é confirmada uma única vez.

**Plantão:** após 21h, conservar pelo menos um funcionário/posto de conferência **operacional** enquanto houver devoluções possíveis; o retorno não pode depender de um funcionário que já foi desligado do turno. Os três NPCs seguem trabalhando, podem regressar e conferir volumes. Não gerar um novo funcionário de maneira instantânea para mascarar erro, nem teletransportar pacotes. B1-06 futuramente otimiza postos, navegação, separação, desempenho e número/fluxo de funcionários, sem recriar estados de pacote nem revogar o plantão.

### C4 — Relógio, término e economia

Proposta: `Shift{shiftId,careerId,calendarDate,elapsedVirtualMinutes,phase,actorProgress,lateByActor}`. A hora visível pode passar de 23h59 para 00h00, mas `elapsedVirtualMinutes` continua crescente, **sem criar novo expediente**. O atraso individual é calculado a partir de 21h da mesma jornada (não de `clock.hour>=21` isolado). Nenhum botão, NPC, base ou ação de entrega pode usar 21h como veto definitivo depois das decisões 14 e 17.

**Término:** estados distintos para `operacoes_pendentes`, `operacoes_resolvidas`, `retorno_pendente` e `expediente_encerrado`, preservando a obrigação de concluir tudo antes da troca. **Proposta técnica para o limite B1-01/B1-09:** reservar desde já quatro pontos domiciliares seguros e permitir terminar a jornada por uma interação mínima válida no ponto da própria casa, sem implementar interiores ou animações completas. Assim é possível testar fim de turno e mudança de carreira sem declarar falsamente que o B1-09 completo já existe. B1-09 depois aprofunda o retorno visível de todos, resumo e próximo dia, sem mudar o contrato de término.

**Pagamentos:** eventos remunerados vinculados a `parcelId` + tipo de operação + `shiftId`, contabilizados idempotentemente (cada entrega válida paga no máximo uma vez; devolução não paga entrega). Não inventar nova tabela de valores, bônus ou multas nesta etapa; usar apenas regras econômicas já aprovadas e identificáveis.

### C5 — Snapshot, retomada e backup

Proposta: um armazenamento local versionado por `careerId` (avaliar IndexedDB), com `schemaVersion`, `shiftId`, relógio monotônico, personagem/veículo/posição segura, pacote + custódia + resultado + eventos, postos/atividades de base, progresso dos NPCs, pagamentos já confirmados, saca/rota/carga física e `checkpointSequence`. Salvar **após ações importantes e ao pausar**; tentativa adicional ao sair do navegador sem confiar nesse evento. Reabrir no último ponto seguro; reconstruir tráfego/NPCs sem reverter entregas, inventário ou remuneração.

Backup deve permitir exportar/importar com validação, identificar carreira e versão, rejeitar corrupção antes de sobrescrever dados; prever migração do armazenamento legado do índice do calendário sem destruir dados existentes. Testar falha em transição e restauração antes/depois de 21h e 00h. Não criar backend, conta ou assinatura.

## 4. Fronteira por módulo — não repetir trabalho

| Módulo | Depende do contrato B1-01 | Acrescenta depois; **não postergar o exigido no B1-01** |
|---|---|---|
| B1-02 — Casas | `careerId/homeId/sectorId`, âncoras válidas e 11h30 | Interiores compactos, equipamentos na casa e preparação detalhada dos quatro |
| B1-03 — Lojas | Atribuição por ator/carreira, IDs de loja, capacidade/rotas e casa | Expandir **8 lojas atuais para 12**, idealmente 3/setor; equilibrar atribuição por proximidade |
| B1-04 — Trânsito/corredor | Veículos com colisores/dimensões e navegação | Corredor de motos com espaço real, sem clipping; não bloquear direção do carro |
| B1-05 — Pacotes/moto | ID/custódia e dimensionamento compartilhados + **carga avançada do carro completa** | Baú/alforjes/suportes da moto, capacidade visual e limite das mãos |
| B1-06 — Base | Pipeline físico único, quatro sacas e **plantão após 21h funcional** | Reservas de postos, navegação sem sobreposição e velocidade operacional |
| B1-07 — Entregas | Entrega válida, tentativa frustrada, devolução física e conferência, sem duplicação | Campainha, personagens/alternativas, vizinhos e eventos engraçados/arriscados |
| B1-08 — Audiovisual | Ações/eventos de domínio expostos à apresentação | Sons, animações e humor, sem reescrever custódia |
| B1-09 — Fim do expediente | Resolução dos quatro entregadores, horário contínuo, casa vinculada e término válido | Retorno doméstico completo dos NPCs, resumo financeiro, próximo dia e calendário |

## 5. Ordem de implementação interna proposta — um B1-01, não oito novos módulos

Todos os passos abaixo ficam na **mesma branch `feat/beta1-01-carreiras`** com commits pequenos, regressões por etapa e PR destinado à `preview`. São marcos **internos**, não aceites parciais que liberem B1-02.

1. **F1 — Identidades, snapshots e cenários base:** abstrair `careerId` de `ActorId`; testes de quatro perfis sem progressão dos inativos; migrador não destrutivo do calendário; base de snapshot e pontos seguros.
2. **F2 — Veículo neutro:** preservar joystick/controles moto (CTRL-002), adicionar carro dirigível/estacionável com câmera, colisão e entrada/saída; controles Android, teclado e HU(D) coerentes.
3. **F3 — Caixas e porta-malas:** dados dimensionais mínimos, arrumação automática, abrir/fechar porta-malas, posições visuais reais, limites de capacidade; integração com inventário único e recarga.
4. **F4 — Coleta/base/entrega com carro:** adaptar `DepotVisit`, `DeliveryGame`, `Workday` e `LogisticsDay`; ciclo completo de coleta/recebimento/expedição/entrega; preservar fluxo de moto.
5. **F5 — Exceções e madrugada:** tentativas frustradas/devolução conferida, plantão real, quatro entregadores ativos depois de 21h, atrasos individuais, continuidade em 00h, encerramento só com todas as pendências resolvidas.
6. **F6 — Recuperação, backup, fim de turno mínimo:** testar interrupção em operações, retomada em local seguro, restauração e isolamento dos quatro perfis; troca de carreira apenas após expediente validamente encerrado.
7. **F7 — Matriz integral de aceite:** executar e evidenciar **AC-01 a AC-26**, regressões de todos os testes antigos, CI e browser E2E com tráfego. O teste em Galaxy S24 físico é do usuário, não resultado inventado pelo runner.

**Entrega vertical obrigatória de validação interna:** provar **um personagem + um carro + uma coleta + base + entrega + retorno** com dados reais de pacote e save, depois ampliar e demonstrar os quatro perfis e os casos de madrugada. Esta prova interna **não substitui** as 26 condições de aceite.

## 6. Regra operacional de próxima etapa

- Este alinhamento é documental; não toca em `src/`, `public/`, `index.html`, `docs/beta1/STATE.json` nem em workflow.
- `B1-00=APROVADO`; `B1-01=PENDENTE` permanece assim até **autorização específica de implementação**. Ao autorizar, seguir `docs/beta1/B1_00_RUNBOOK.md`: registrar `EM_DESENVOLVIMENTO` em `preview`, criar branch `feat/beta1-01-carreiras`, executar F1–F7 e entregar para testes/aceite, sem encostar em `main`.
- Especificação B1-01 de **17 decisões/26 AC congelados não muda** por esta proposta de arquitetura. Se algum detalhe técnico não puder satisfazer o contrato, abrir desvio explícito e pedir decisão antes de enfraquecer os testes; não fingir cumprimento.
- A fase operacional existente de `preview` (11h45, 8 lojas, moto, corte 21h) **não é** a Beta implementada. A documentação congelada de B1-01 contém uma referência histórica a B1-00 pendente; o **estado atual** de aprovação deve ser consultado em `docs/beta1/STATE.json`. Esta nota não reabre nem modifica o texto funcional congelado.

**Resultado:** dependências estruturais e fronteiras de escopo mapeadas; não foram identificadas novas escolhas de produto essenciais para planejar a execução do B1-01. **Nenhuma prova de implementação ou teste do B1-01 é reivindicada.**
