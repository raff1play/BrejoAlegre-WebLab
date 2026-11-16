# B1-01 — F6: persistência, retomada e conclusão segura (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Status:** F6 entregue para revisão técnica, conforme a reauditoria F5 (comentário 6906372470 do PR #15). **B1-01 NÃO está concluído**: a F7 não foi iniciada. **NÃO PUBLICADO.** As 17 decisões, os AC-01–AC-26 e `docs/beta1/STATE.json` não foram alterados.

## O que mudou (itens 1–6 da autorização)

| Item | Arquivo(s) | Implementação |
|---|---|---|
| 1. Checkpoints duráveis por carreira | `src/core/career/snapshot.ts` (schema **v3**), `shiftCheckpoint.ts`, `src/main.ts` | O save de cada carreira passa a gravar o expediente vivo: `shiftId`, `elapsedVirtualMinutes` + `shiftHour` monotônico (validados entre si), fase, os quatro atores (`roster`, `finishedAt`, `lateByActor`), todos os pacotes com histórico, posição física e `stowage`, o **mundo** (`shift.world`: rotina do jogador, designações, rota, liberação, ausências, base com cada trabalhador e a tarefa física em curso, os três NPCs com estado, poses, rota e paradas, van), a pose do veículo e do jogador, e a razão de pagamentos. Gravação: ao abrir o expediente; logo depois de cada ação de custódia do jogador; na pausa; depois de eventos de custódia de NPC/base (no máximo a cada 8 s); periódica (30 s); nova tentativa 5 s depois de uma falha; uma tentativa extra em `visibilitychange`/`pagehide`, sem depender dela. Tudo é validado por inteiro antes de qualquer escrita; estado parcial/incoerente (tarefa de pacote inexistente, pacote em transferência sem trabalhador, NPC faltando, saldo sem lastro, pagamento sem prova, relógio ou fase divergentes, expediente com pacotes sem mundo) é recusado sem tocar no save íntegro. Falha de gravação (ex.: `QuotaExceededError`) mantém o principal e a cópia anterior, avisa o jogador e tenta de novo |
| 2. Continuar restaura o expediente real | `LogisticsDay.captureState/restoreState`, `Courier`, `DepotOperations`, `SupplierVan` (`toState/restoreState`), `restoreShift`, `main.ts` | Um `LogisticsDay` novo recebe os pacotes do save (objetos novos, mesma ordem, mesmos IDs e histórico) e o mundo; `start()` não roda, então nada é recriado na loja nem pago de novo. O relógio volta exatamente à hora do checkpoint (nunca para trás; com expediente aberto, `?dia`, `?seed` e `?hora` de desenvolvimento são ignorados). O veículo volta à pose salva se couber no mundo estático (senão, na vaga da base, avisado); o jogador volta a pé ou no veículo como estava; a tampa do porta-malas volta fechada (as caixas ficam nos slots salvos). Lojas começam no estado da hora. Trânsito e pedestres são recriados; um veículo de rua não nasce a menos de 8 m das motos dos NPCs nem do veículo do jogador (`Traffic.spawnFar`, `TrafficContext.avoid`). Não existe segundo inventário: só a lista única de `Parcel` |
| 3. Razão idempotente de remuneração | `src/core/career/ledger.ts`, validação em `snapshot.ts` | Valores da tabela aprovada **D07** (`docs/product/ORIGINAL_GODOT_SPEC.md` §5), em centavos: **COLETA** R$ 0,50 por volume coletado pelo jogador **e** recebido fisicamente na base (`RECEBIDO_BASE`); **ENTREGA** moto ML R$ 7, moto SHP R$ 5, carro ML R$ 9, carro SHP R$ 5, só quando o evento anterior a `ENTREGUE` está nas mãos do jogador. Entrega de NPC, tentativa, `DEVOLVIDO_E_CONFERIDO` e transferência: R$ 0. Cada evento é `<shiftId>/<parcelId>/<tipo>` e derivado do histórico; pagar = acrescentar os eventos devidos que ainda não estão na razão, então reaplicar após recarregar não paga nada. O schema recusa valor fora da tabela, tipo não aprovado, evento sem prova, duplicado e saldo ≠ abertura + razão |
| 4. Backup | `CareerStore.exportBackup/previewBackup/importBackup`, `marksKey` | O backup é o próprio save canônico de **uma** carreira (formato, `schemaVersion`, carreira, linhagem, checkpoint, checksum). Política: só **entre expedientes** (nem exportar com expediente aberto, nem importar backup com expediente, nem importar sobre expediente aberto); validação completa antes de escrever; **linhagem** (`profile.lineageId`, uma por encarnação da carreira) e **marcas** por linhagem (`brejo-b1:marcas:<carreira>`, maior checkpoint confirmado neste navegador, mantidas mesmo depois de apagar): um backup mais antigo do que o já confirmado é recusado (reverteria operações e pagamentos); por cima de **outra** encarnação, ou de save ilegível, só com confirmação explícita (a atual fica como cópia anterior). Migração v1/v2 → v3 conferida pelo checksum antes de migrar; calendário legado preservado |
| 4b. Abas simultâneas | `src/core/career/tabLease.ts`, `src/features/career/tabLock.ts`, menu | **Uma aba grava por vez**: a aba do jogo segura um Web Lock exclusivo (`brejo-b1:jogo`) durante toda a vida (o navegador o libera ao fechar ou travar). Outra aba abre o menu **somente leitura** (faixa, entrar e gerenciar desativados, "Tentar novamente"). Sem Web Locks: lease em `localStorage` renovado a cada 2 s, livre após 8 s. A verificação de sequência do `CareerStore` continua como segunda defesa (sessão desatualizada para de gravar) |
| 5. Fim de turno mínimo | `shiftCheckpoint.ts` (`closureState`, `homeClosureCheck`, `closeShiftAtHome`), `LogisticsDay.objective`, `main.ts`, `logisticsPanel.ts`, `index.html` (`#shift-end`) | Estados do contrato C4: `operacoes_pendentes` → (tudo resolvido pelos quatro) `retorno_pendente` → `expediente_encerrado`. Com `CONCLUIDA` o objetivo passa a "Voltar para casa — <rua>"; só na porta da **própria** casa (≤ 2,4 m, a pé, veículo parado a ≤ 30 m do ponto de parada da casa) aparece "Encerrar o expediente em casa"; na casa de outro personagem o botão diz que não serve. Encerrar = **um** checkpoint: o expediente final é validado por inteiro, a razão vai para o saldo, `activeShiftId` e `shift` zeram, o calendário avança para o próximo dia útil uma vez e `lastClosedShift` guarda o resumo. Só então a troca de carreira é liberada. 21h e a última entrega continuam sem encerrar nada |
| 6. Gerenciamento seguro dos quatro saves | `src/features/career/mainMenu.ts`, `index.html` (`#menu-saves`), `CareerStore.deleteCareer` | Opções → Gerenciar saves: os quatro personagens com estado real (principal, cópia anterior, ilegível, legado). Exportar (download); importar (prévia com carreira/dia/checkpoint/saldo/veículo e confirmação); apagar (1º toque só pergunta e oferece exportar antes; 2º toque "Apagar <nome> definitivamente"). Tudo bloqueado com expediente aberto e na aba somente leitura. Apagar remove principal e cópia anterior só daquele personagem; para Oeste a chave legada é **mantida** (builds antigos) e marcada como descartada para não voltar como carreira. Nada é sobrescrito automaticamente |

## Decisões de engenharia (auditáveis, não são decisões de produto)

- **Expediente aberto desde o início do dia:** o primeiro checkpoint (11h45, designação das lojas) já grava `activeShiftId`; daí em diante a troca de carreira fica bloqueada até o encerramento em casa (decisão 8).
- **Retomada exata:** o checkpoint guarda também o passo anterior da base e dos NPCs (`lastUpdateHour`, `previousHour`); o mundo retomado continua com o mesmo ritmo. Os testes unitários mostram que fechar e reabrir em 8 pontos termina igual ao dia contínuo.
- **Armazenamento:** continua `localStorage`. Um save de dia cheio tem ≈ 170 kB (×2 com a cópia anterior, por carreira). Um checkpoint custa ≈ 24 ms no Node desktop (validação + checksum duas vezes); sem medição em Android.
- **Checksum FNV-1a** detecta corrupção e edição acidental; **não** protege contra fraude deliberada.
- **Raio de casa** (2,4 m da porta, 30 m do veículo) e intervalos de checkpoint são calibração.

## Divergências registradas (não resolvidas por invenção)

1. **Fonte econômica:** a tabela D07 está em `docs/product/ORIGINAL_GODOT_SPEC.md`, numa seção chamada "Economia e carreira — implementação posterior", e `docs/product/WEBLAB_SCOPE.md` pede para não acrescentar economia permanente como consequência da limpeza. O AC-22 manda seguir a "especificação econômica vigente" e a reauditoria F1 (6899766654) mandou usar o evento `COLETA` de D07. **Foram usados apenas os valores de D07.** Nenhum bônus, multa, combustível, manutenção ou renda de NPC.
2. **Plataforma `LOJA`:** D07 não tem valor para ela. Ela só existe no cenário legado de um entregador (`Workday`, sem `LogisticsDay`). `rateCents` devolve `null` e nenhum evento é criado. Não há valor inventado.
3. **D10 ("expediente encerra às 21h")** contradiz as decisões congeladas 14 e 17 do B1-01, que prevalecem. Nada encerra às 21h.

## Testes

- `tests/b1-01-persistence.test.ts` (11):
  - Moto (Oeste) e carro (Leste): o dia inteiro é fechado e reaberto **8 vezes**, refazendo tudo a partir dos bytes do armazenamento. Os pontos: antes e logo depois da 1ª transferência, com a base trabalhando, depois de 20h59 e de 21h01, com a tentativa no veículo, depois de 00h01 e com a devolução na mesa do plantão. O resultado final é **igual** ao do dia contínuo em pacotes, histórico, razão, saldo, NPCs e relatório. Os checkpoints e o relógio só avançam, e o porta-malas fica válido.
  - Razão D07: valores corretos, sem pagamento de devolução nem de NPC, e reaplicar não acrescenta nada.
  - Save parcial ou corrompido é recusado e o save íntegro fica intacto; com o principal ruim entra a cópia anterior; com as duas cópias ruins, a carreira não vira Novo jogo.
  - `QuotaExceeded`: o save anterior fica intacto, o jogo segue e a nova tentativa grava sem salto.
  - Agendamento: ação imediata, intervalo mínimo e periódico; nada antes do início; relógio que regride é recusado.
  - Duas sessões (a desatualizada para de gravar) e lease de aba.
  - Backup e exclusão: tudo da política acima, inclusive manter as marcas depois de apagar e o legado.
  - Encerramento só com tudo resolvido e na porta da própria casa (moto, carro, pé, outra casa); calendário uma vez; troca liberada depois; os outros saves ficam byte a byte.
  - Quatro carreiras isoladas, com bloqueio no menu.
  - Migração v2 → v3.
- Testes antigos ajustados **só** pelo schema v3, sem remover nenhuma asserção:
  - `elapsedVirtualMinutes` agora vem com o `shiftHour` correspondente.
  - Pagamentos usam os valores D07, com mundo e saldo coerentes. Foram **acrescentadas** recusas de valor inventado e de saldo sem lastro, e o caso positivo de `COLETA` (antes era recusada, a reauditoria F1 corrigiu isso).
  - Restaurar um backup **mais antigo** agora é recusado. A F1 aceitava isso, e a reauditoria F1 apontou que isso revertia o saldo.
  - Um save v1/v2 com pacotes e sem mundo agora é recusado com o motivo. A F1–F5 nunca gravou um save assim.
- `tests/e2e/current-smoke.cjs` (Chromium, toque, trânsito ligado):
  - **Jornada do carro** (780×360 e 915×412): pausa, fecha e Continuar em três momentos. São eles: com a coleta no porta-malas antes da base, logo depois da 1ª transferência ao conferente, e depois de 00h01 com a tentativa no porta-malas. Em cada um:
    - o histórico de cada pacote continua o do checkpoint;
    - slots e caixas são idênticos;
    - os NPCs voltam no estado e na pose salvos;
    - nenhum veículo de rua fica sobre o carro ou as motos;
    - HUD sem sobreposição.

    No fim da jornada: a razão D07 está no save; `CONCLUIDA` não encerra o expediente; o encerramento é feito na porta de casa; vem o cartão de fim de expediente; o menu oferece o dia seguinte e as outras três carreiras livres.
  - **Moto** (915×412): coleta e baú são gravados na hora; `QuotaExceeded` é simulado, avisado e a nova tentativa grava. Uma segunda aba real recebe o menu somente leitura e não grava. Quando a primeira fecha, "Tentar novamente" pega o lock e Continuar retoma o baú.
  - **Gerenciar saves**: os saves vêm de `fixtures/backups.ts`, construídos pelas funções reais. O teste cobre: exportar (download); as recusas, que não gravam nada (corrompido, desatualizado, de outra carreira); substituir só com confirmação; apagar só com a 2ª confirmação; o backup antigo continua recusado depois de apagar; o último export restaura.
  - **Quatro carreiras**: cada uma entra ao lado dos saves fechados das outras três (`fixtures/closed-careers.ts`). Os outros saves ficam byte a byte, o expediente aberto bloqueia as outras e Continuar retoma.

## Limites e pendências

- No E2E, o deslocamento e o tempo continuam vindo de fixtures (`parkCarNear`, `placeWalker`, `setShiftHour`, `worldStep`). Não é uma partida humana completa.
- Na troca de aba do E2E da moto, dois botões do menu da segunda aba são acionados por clique DOM: depois que a aba que renderiza fecha, o toque CDP trava no SwiftShader.
- Não são persistidos: a fila de clientes das lojas, os pedestres e o trânsito (recriados), e a tampa do porta-malas aberta (volta fechada, que é ponto seguro). Os erros de diagnóstico da base guardam só os últimos 50.
- A casa ainda não tem interior nem rotina, e o retorno dos NPCs para casa e o resumo completo do dia ficam para o B1-09. O encerramento mínimo usa os pontos `door`/`stop` da F1.
- Concorrência: com Web Locks, a exclusão é garantida pelo navegador. No fallback de lease, duas abas abertas no mesmo milissegundo ainda podem disputar a vaga; a verificação de sequência impede gravação desatualizada.
- O tamanho do save (≈ 170 kB) e o custo do checkpoint não foram medidos em Android. Com quatro carreiras e cópias anteriores, o uso fica perto de 1,4 MB de `localStorage`.
- **Galaxy S24 físico: NÃO TESTADO.**
