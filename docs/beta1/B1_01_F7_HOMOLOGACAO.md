# B1-01 — F7: homologação técnica (matriz AC-01 a AC-26)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Autorização:** reauditoria F6 (comentário 6917133021).
**Status:** homologação **técnica** entregue para auditoria e decisão humana.

- Este documento **não** aprova o B1-01.
- Não houve merge nem publicação manual.
- `main`, `preview`, `lab/beta1-playtest` e `docs/beta1/STATE.json` não foram alterados.
- Fonte normativa: `docs/BETA_1_0_SPEC.md` (17 decisões e AC-01–AC-26, congelados, sem alteração).

## Como ler a matriz

| Tipo de evidência | O que prova | O que NÃO prova |
|---|---|---|
| **Unitário** (`tests/*.test.ts`, `node --test`) | Regras de domínio com os objetos reais do jogo (`LogisticsDay`, `Parcel`, `CarTrunk`, `CareerStore`, física do carro/moto), sem mocks de domínio | Renderização, toque, desempenho |
| **E2E** (`tests/e2e/current-smoke.cjs`, Chromium headless/SwiftShader, `isMobile`+`hasTouch`, **trânsito ligado** salvo onde indicado) | O jogo real no navegador: menu, HUD, botões por toque/teclado, custódia via botão de ação, saves em `localStorage` real, recargas | Android físico, FPS real, uma partida humana contínua |
| **Fixture de deslocamento/tempo** (`__debug.parkCarNear`, `parkAt`, `placeWalker`, `setShiftHour`, `worldStep`, `markAbsent`) | Leva o jogador/veículo/relógio a um ponto; **não edita pacotes** | Que o percurso foi dirigido pelos controles |

**Limitação global L1:** não existe E2E de uma jornada inteira conduzida só pelos controles. O E2E dirige com teclado e toque em trechos:
- moto na rua (aceleração, multitoque, analógico, desmontar e montar);
- carro até a cerca e de ré para fora da parede;
- **F7:** carro de ré **para dentro da vaga da base** pelo pedal.

Os deslocamentos entre lojas, base e endereços usam fixture. O roteiro manual no fim deste documento cobre a jornada dirigida.

## Execução

| Comando | Resultado |
|---|---|
| `npm run check` (local, depois da correção 6918411665) | exit 0: `validate:repo` OK (37 arquivos), **276/276 unitários**, typecheck, `build:staging` OK |
| `npm run test:e2e` (local, depois da correção 6918411665) | exit 0: **309 checks**, `no fatal JavaScript errors` (a contagem varia ±2 com o número de paradas da rota) |
| CI oficial no SHA final | registrado no comentário de entrega do PR #15 |

## Matriz

Status: **aprovado** = comportamento exercitado de verdade e observado; **parcial** = parte exigida sem prova ou dependente de teste humano/físico; **bloqueado** = falha conhecida.

| AC | Requisito (resumo do texto congelado) | Componentes | Testes que exercitam o comportamento | Resultado observado | Limitações | Status |
|---|---|---|---|---|---|---|
| AC-01 | Quatro IDs, setores e casas distintos, perfis sem dados mutáveis compartilhados | `core/career/careers.ts`, `snapshot.ts` (`defaultProfile`), `careerStore.ts` (uma chave por carreira) | Unit: `b1-01-careers.test.ts:15`, `b1-01-saves.test.ts:27`, `b1-01-menu.test.ts:20`. E2E `mainMenu` ("Novo jogo lists exactly four career cards") e `fourCareers` | 4 IDs/setores/casas distintos; perfis congelados e independentes; menu com os quatro | Nomes provisórios (fora do escopo congelado) | **aprovado** |
| AC-02 | Presets masculino/feminino e equipamentos, preservados após reiniciar | `snapshot.customize`, `features/career/characterPresets.ts`, `character.ts` | Unit: `b1-01-saves.test.ts:42`, `b1-01-menu.test.ts:51,127`. E2E `fourCareers`: preset vestido a pé e no veículo, e relido após `reload` | Presets gravados no save da carreira, aplicados ao pedestre, ao piloto e ao motorista, e relidos depois de reiniciar a página | Catálogo de equipamentos provisório; sem editor facial (fora do escopo) | **aprovado** |
| AC-03 | Moto antiga OU carro antigo, quitado, vinculado de forma permanente | `snapshot.chooseStartingVehicle`, `careerMenu.enterCareer`, `vehicleChoice.ts` | Unit: `b1-01-car.test.ts:205,222`, `b1-01-menu.test.ts:75`. E2E `carCareer` ("after reloading … not offered again"), `fourCareers` ("re-entering … keeps the saved …") | A escolha acontece uma vez e é recusada se repetida (inclusive por outra aba); recarregar não oferece nova escolha | — | **aprovado** |
| AC-04 | Moto com controles Android/teclado, aceleração, freio, colisão, desmontagem e retomada sem regressão da CTRL-002 | `core/motorcyclePhysics.ts`, `analogStick.ts`, `features/controls/input.ts`, `playerVehicle.motoVehicle` | Unit: `analogStick.test.ts`, `collision.test.ts`, `simulation.test.ts`, `b1-01-car.test.ts:181` (curva CTRL-002 inalterada). E2E fluxo principal (915×412, trânsito): analógico, multitoque, freio/ré, zoom, desmontar/montar ("getting back on the bike still works"); `persistenceMoto` (moto retomada na pose salva, sem veículo de rua sobre ela) | Todas as verificações CTRL-001/002 continuam passando; retomada da moto verificada | Toque emulado por CDP no Chromium, **não Android físico**; sem medição de FPS | **aprovado** (técnico; aparelho pelo usuário) |
| AC-05 | Carro dirigível, estacionável, com colisores e câmera coerentes, entrar/sair em áreas válidas | `core/carPhysics.ts`, `features/driving/playerCar.ts`, `playerVehicle.carVehicle`, `isometricCamera.setDriveFraming`, `depotPlan.depotCarBay` | Unit: `b1-01-car.test.ts:32–193` (colisores, ré, giro, freio de mão, sair/entrar, vaga). E2E `carCareer`: teclado até a cerca sem atravessar (`:122`), ré para fora, analógico+pedal em multitoque, entrar/sair pela porta, recusa longe da porta, **F7: ré dirigida até dentro da vaga 1 reconhecida** (`:236`) | Corpo sempre livre do mundo; a vaga só é reconhecida com os quatro cantos dentro; a ré dirigida entra na vaga | Estacionar dirigindo foi provado só em linha reta (ré de 4 m); manobra com esterço até a vaga não está no E2E | **aprovado** |
| AC-06 | Abrir o porta-malas; cada caixa com ID visível individualmente, com posição e persistência coerentes | `core/delivery/carTrunk.ts`, `parcels.stowage`, `features/driving/carCargo.ts` | Unit: `b1-01-trunk.test.ts:82,191,208`. E2E `carBoot` (`:321` uma malha por ID no slot do domínio; `:327` sem interpenetração), `carLogistics` → `resume` (slots e caixas idênticos depois de recarregar) | Uma caixa 3D por ID, no slot gravado, antes e depois de recarregar | — | **aprovado** |
| AC-07 | Carga automática respeita tamanho e capacidade; carro cheio não aceita mais, caixas não se atravessam, o que não cabe fica sob posse válida | `CarTrunk.stow/plan/arrange` | Unit: `b1-01-trunk.test.ts:62` (1.030 cargas reais cabem), `:104` (sobrecarga de 60 volumes recusada, excedente nas mãos), `:124` (120 sequências aleatórias), `:267`. E2E `carBoot` `:327` | Excedente recusado e mantido nas mãos; nenhuma sobreposição | No navegador as cargas reais sempre cabem (pior caso 217 de 339 L): a recusa por excesso só foi observada no domínio | **aprovado** |
| AC-08 | Carro coleta nas lojas e guarda fisicamente, sem duplicar ID nem custódia | `Workday.collect`, `CarTrunk.stow`, `deliveryGame.action` | Unit: `b1-01-car-logistics.test.ts:41`. E2E `carLogistics` `:774` (coleta no balcão e guarda por toque) | `COLETADO → mãos → EM_TRANSPORTE → porta-malas`, IDs únicos | Chegar à loja usa `parkCarNear` (fixture) | **aprovado** (transições); percurso: L1 |
| AC-09 | Carro estaciona e descarrega na base, passa por recebimento, conferência e triagem existentes, sem teleportar pacotes | `workday.depotVisitAllowed/unloadCarForDepot`, `DepotOperations` | Unit: `b1-01-car-logistics.test.ts:28,41`. E2E `carLogistics` `:808` (viagens porta-malas → mãos → recebimento) e pipeline até a saca; E2E `carCareer` `:236` (entrada dirigida na vaga) | Sem teleporte (histórico exato); pipeline sem erro da base | Na jornada, a vaga é ocupada por `parkAt`; a entrada dirigida na vaga foi provada separadamente | **aprovado** |
| AC-10 | Carro recebe a carga do setor, organiza e entrega com transições auditáveis | `LogisticsDay.takeLoad`, `takeFromCarForAddress`, `deliver` | Unit: `b1-01-car-logistics.test.ts:41,121`. E2E `carLogistics` `:828` e paradas "only the parcels of ONE address" | `EM_ROTA → mãos → porta-malas → mãos → ENTREGUE → destinatário`, uma vez | Deslocamento entre endereços por fixture | **aprovado** (transições); percurso: L1 |
| AC-11 | Tentativa registrada sem entrega; o pacote fica sob custódia e pendente até devolução e conferência | `parcels.attemptFailed`, `Workday.registerAttempt`, `Courier` (handoff) | Unit: `b1-01-night.test.ts:39,122,197`. E2E `carLogistics` `:867` | `TENTATIVA_FRUSTRADA` nas mãos do jogador, nunca `ENTREGUE` | Ausência do destinatário forçada no E2E por `markAbsent` (agenda, não estado do pacote) | **aprovado** |
| AC-12 | Devolver e conferir fisicamente leva a resultado final válido **não entregue**, sem pagamento | `parcels.confirmReturn`, `DepotOperations` (plantão), `ledger.ts` | Unit: `b1-01-night.test.ts:39,122`, `b1-01-persistence.test.ts:189`. E2E `carLogistics` `:908`, `:920` (razão sem ENTREGA da devolução) | `DEVOLVIDO_E_CONFERIDO` na prateleira de devoluções, nunca pago como entrega | — | **aprovado** |
| AC-13 | Nada de concluir nem trocar de perfil com pendência; nada de cancelamento antecipado | `LogisticsDay.allResolved/update`, `closeShiftAtHome`, `CareerStore.setActiveCareer`, `menuModel` | Unit: `b1-01-night.test.ts:185,281`, `b1-01-persistence.test.ts:386`. E2E `carLogistics` `:890`, "CONCLUIDA is not the end", `lockedMenu`, `fourCareers` (bloqueio) | Nenhum caminho encerra com pendência; não existe botão de abandonar | — | **aprovado** |
| AC-14 | Entregas válidas às 20h59 e às 21h01; a tardia registra atraso; nada encerra às 21h | `VirtualClock.shiftHour`, `LogisticsDay.report` | Unit: `b1-01-night.test.ts:122`, `log003-operation.test.ts`. E2E `carLogistics` `:882` | As duas entregas funcionam; atraso só na de 21h01; fase não encerrada | Horário levado a 20h54/20h59/21h01 por `setShiftHour` (fixture de tempo) | **aprovado** |
| AC-15 | Atravessar 00h sem perder pacote, fase ou ID do expediente, sem virar novo dia | `VirtualClock` monotônico, `shiftIdOf`, `captureShift` | Unit: `b1-01-night.test.ts:29,122`, `b1-01-persistence.test.ts:143` (retomada depois de 00h01). E2E `carLogistics` `:883`, `resume('depois de 00h01 …')` | `shiftHour > 24`, mesmo `shiftId`, mesmo dia de calendário, relógio `(+1)` | Tempo por fixture | **aprovado** |
| AC-16 | Os três NPCs trabalham e **não** recebem dinheiro, experiência, calendário nem gravam nos saves inativos | `buildRoster`, `CareerSession` (único escritor), `ledger.deliveredByPlayer` | Unit: `b1-01-saves.test.ts:129`, `b1-01-menu.test.ts:51`, `b1-01-persistence.test.ts:189` (entregas de NPC sem pagamento), `:452`. E2E `fourCareers` `:451` (saves das outras byte a byte) | Saves inativos intactos byte a byte; razão só com eventos do jogador | — | **aprovado** |
| AC-17 | O menu não permite alternar com expediente aberto; depois da finalização válida, a troca é liberada | `CareerStore.setActiveCareer/openShift`, `menuModel`, `closeShiftAtHome` | Unit: `b1-01-saves.test.ts:192`, `b1-01-menu.test.ts:91,248`, `b1-01-persistence.test.ts:386,452`. E2E `fourCareers` (expediente aberto real bloqueia as outras), `lockedMenu`, `carLogistics` `:938` (depois do encerramento, livre) | Bloqueio com expediente aberto real; troca liberada só depois de encerrar em casa | — | **aprovado** |
| AC-18 | Checkpoints em coleta, acondicionamento, descarga, entrega, devolução conferida e pausa, íntegros e sem operação parcial | `ShiftCheckpointer` (ação do jogador, **evento de NPC/base no mesmo quadro** desde a correção 6918411665, pausa, periódico, saída), `captureShift`, validação v3, `sealSaveText` | Unit: `b1-01-persistence.test.ts:143,219,261,293`, `b1-01-f6-audit.test.ts`, **`b1-01-f7-audit.test.ts`** (o dia inteiro: cada entrega de NPC, cada devolução conferida pelo plantão e cada etapa da base já está no save no quadro em que acontece; falha do storage nesse quadro não grava nada parcial e a nova tentativa grava em ≤ 5 s). E2E `persistenceMoto` (coleta e baú gravados na hora; `QuotaExceeded`), `carLogistics` (entrega ao conferente gravada na hora; pausa; **F7: 40 amostras entre quadros, com trânsito, durante o trabalho real da base: save = custódia viva de todos os pacotes**) | Toda transição de custódia (jogador, NPC ou funcionário) é gravada no mesmo quadro; estado parcial recusado; falha de gravação não perde o save | Defeito encontrado pela auditoria independente (janela de até 8 s para eventos de NPC/base) **corrigido**; ver "Defeitos" | **aprovado** (após a correção; sujeito à reauditoria) |
| AC-19 | Fechar e reabrir carrega o último ponto seguro; entrega, caixa e custódia não regridem | `restoreShift`, `LogisticsDay.restoreState`, `main.ts` (Continuar), checkpoint de evento autônomo no mesmo quadro | Unit: `b1-01-persistence.test.ts:143` (8 interrupções, resultado idêntico ao dia contínuo, moto e carro), **`b1-01-f7-audit.test.ts`** (aba "morta" logo depois de um evento de NPC/base, sem `pagehide`/`visibilitychange`: a nova sessão lê o evento; retomada restaura o `ENTREGUE` do NPC). E2E `carLogistics` → `resume` × 3, `persistenceMoto` | Histórico de cada pacote continua o do checkpoint; nada perdido, duplicado ou regredido, inclusive para eventos de NPC/base | O mundo segue logo depois da retomada; a igualdade exata foi verificada no unitário. Única exceção honesta: se o **armazenamento falha** no quadro do evento, o jogo avisa e a retomada é o checkpoint íntegro anterior (o passo não confirmado é refeito pelo mesmo NPC/funcionário, sem duplicar) | **aprovado** (após a correção; sujeito à reauditoria) |
| AC-20 | Veículos e couriers recriados de forma compatível, sem duplicar sacas ou pacotes nem nascer presos em colisão | `Courier.restoreState`, `DepotOperations.restoreState`, `Traffic.spawnFar` (`avoid`) | Unit: `b1-01-persistence.test.ts:143`. E2E `resume` `:716` (NPCs no estado e na pose salvos; nenhum veículo de rua sobre o carro ou um courier em movimento, trânsito ligado), `persistenceMoto` | Compatível e sem sobreposição no instante da retomada | A verificação de sobreposição cobre o veículo do jogador e os couriers montados; pedestres e motos estacionadas não são verificados (o trânsito evita 8 m de todas as motos) | **aprovado** |
| AC-21 | Exportação e restauração reabrem a carreira correta; corrompido ou versão inválida é rejeitado sem sobrescrever | `CareerStore.exportBackup/previewBackup/importBackup`, `mainMenu` (Gerenciar saves) | Unit: `b1-01-saves.test.ts:208`, `b1-01-persistence.test.ts:336`, `b1-01-f6-audit.test.ts`. E2E `savesMenu` (download, corrompido, desatualizado, outra carreira, substituição confirmada, apagar com 2ª confirmação, bloqueio com expediente aberto `:654`) | Todas as recusas sem mudança de bytes; restauração na carreira certa | Política de backup "só entre expedientes" é decisão de engenharia (decisão 12 deixou o formato e os conflitos em aberto) | **aprovado** |
| AC-22 | Sem pagamento por devolução; sem pagar duas vezes por ID entregue mesmo após restaurar backup; valores seguem a especificação econômica vigente | `ledger.ts` (D07), validação do saldo, marcas anti-reversão | Unit: `b1-01-persistence.test.ts:189,336`, `b1-01-audit-fixes.test.ts:130`, `b1-01-f6-audit.test.ts:59`. E2E `carLogistics` `:920`, `savesMenu` `:605` | Valores D07; reaplicar não paga; backup antigo não reverte; devolução R$ 0 | **Fonte:** D07 está em `ORIGINAL_GODOT_SPEC.md` §5, numa seção marcada "implementação posterior". Foi usada por indicação da reauditoria F1 e precisa de confirmação humana como "especificação vigente" | **aprovado** (técnico; fonte a confirmar) |
| AC-23 | CI, TypeScript, build, E2E com trânsito e toque, HUD/minimapa/controle preservados; desempenho em Android físico só quando o usuário testar | `.github/workflows/ci.yml`, todos os E2E | CI do PR (verify + browser-smoke); E2E: layout do HUD em 780×360 e 915×412 em base/rua/a pé/carro/retomado, minimapa (rumo, zoom, rota, recálculo), multitoque | Tudo verde (ver CI); minimapa ≤ 12 ms por redesenho no SwiftShader | **Android físico / FPS real: NÃO TESTADO** (a cargo do usuário, como o AC prevê) | **parcial** (automação aprovada; falta o teste do usuário em aparelho) |
| AC-24 | Com entregas pendentes às 21h, os três NPCs continuam a logística, sem parar em `hour>=21`, sem teleporte | `Courier.update`, `DepotOperations` (`pendingIntake`) | Unit: `b1-01-night.test.ts:122,243,272`. E2E `carLogistics` `:909` (Rosa: tentativa, devolução e conferência depois de 21h) | NPCs entregam e devolvem depois de 21h; as etapas só avançam por tarefa física | `worldStep` acelera o mundo (mesmas chamadas do loop) | **aprovado** |
| AC-25 | Depois de 21h (e de 00h) há um posto/funcionário de verdade na base para receber e conferir devoluções | `ON_DUTY_ROLES` (`conferente`), `DepotOperations` | Unit: `b1-01-night.test.ts:122,243,272`. E2E `carLogistics` `:908` (conferida pelo `conferente` depois de 00h) | Conferente real confere depois de 00h | — | **aprovado** |
| AC-26 | Relatório com horário e atraso de cada um dos quatro; não encerra com pendência; ao concluir, permite o retorno físico à própria casa (B1-09) | `LogisticsDay.report/finishedAt`, `closureState`, `homeClosureCheck`, `closeShiftAtHome` | Unit: `b1-01-night.test.ts:122`, `b1-01-persistence.test.ts:386`. E2E `carLogistics` `:911` (quatro atrasos distintos), "CONCLUIDA is not the end", `:930` (encerrado na porta da casa de Lia) | Relatório por entregador; retorno mínimo em casa exigido e provado no domínio | Retorno doméstico completo dos NPCs, resumo e interiores ficam para o B1-09; chegar em casa usa fixture | **aprovado** |

**Resumo:** 25 aprovados (AC-04, AC-22 e AC-26 com ressalvas declaradas), **1 parcial (AC-23)**, nenhum bloqueado. A jornada contínua dirigida pelos controles (L1) e o Android físico não estão provados por automação.

## Defeitos encontrados no gate F7

1. **Teste com espera fixa (não é defeito do jogo).** A leitura da câmera do carro em `carCareer` usava espera fixa de 600 ms. Rodando o cenário sozinho, a câmera ainda estava se acomodando (raio 6,51, alvo 1,15 m) e o check falhou uma vez. Correção: esperar a câmera se acomodar (até 5 s) antes de ler; o critério continua o mesmo.
2. **Lacuna de evidência, não de código.** Não havia prova de estacionamento dirigido na vaga da base. Foi acrescentado o check E2E da ré pelo pedal até dentro da vaga 1.

3. **Defeito de persistência — janela de até 8 s (auditoria independente, comentário 6918411665; AC-18/AC-19).** Um evento de custódia feito por NPC ou funcionário da base (entrega, devolução conferida, etapas da base) só era gravado 8 s depois do último checkpoint. Se a aba morresse nesse intervalo sem `pagehide`/`visibilitychange`, o `Continuar` restaurava o pacote no estado anterior.
   - **Reproduzido:** `tests/b1-01-f7-audit.test.ts`, commit `test(...) F7 reproduz…`. No código de `7e8f64f`, o `RECEBIDO_BASE` do conferente ainda não estava no save no quadro 14.
   - **Corrigido:**
     - `ShiftCheckpointer.tick` grava no mesmo quadro qualquer mudança de custódia (o intervalo mínimo foi removido);
     - `onExit` só pula quando nada mudou desde uma gravação de menos de 1 s;
     - para não pesar, `CareerStore.commit` grava o save selado com o texto canônico produzido numa única serialização (`sealSaveText`, byte a byte igual a `canonicalJson`, coberto por teste), sem uma segunda leitura do mesmo conteúdo.
   - **Custo medido (Node desktop, não Android):** ≈ 5,4 ms por checkpoint de 182 kB; antes eram ≈ 24 ms. Um dia inteiro de moto teve 527 checkpoints em 19.441 quadros (481 com evento), no pico ≈ 1,5 quadro/s com evento. O desempenho em Android continua não medido.
   - Nenhum outro inventário foi criado; validação completa, checksum, marcas anti-reversão e idempotência inalterados.

Nenhum defeito de regra de jogo foi encontrado; nenhuma regra congelada foi alterada.

## Auditoria de UX mobile (emulada)

- **780×360 e 915×412:** em base, rua, a pé, carro, carro carregado, retomada, menu e todas as telas, gerenciador de saves e cartão de fim de expediente:
  - HUD sem sobreposição, centro livre e painéis dentro da tela;
  - botões com ≥ 40 px e dentro da tela.
- **Toque:** analógico flutuante, multitoque, cancelamento, perda de foco e pausa não capturam o analógico.
- **FPS:** não medido de forma válida. SwiftShader não representa GPU de celular, e nenhum número de FPS é afirmado.
- **Trânsito e colisões:** cobertos pelos testes LOG006 e de tráfego (unitários) e pelo E2E com trânsito ligado. Longas sessões de trânsito no Android continuam sem teste.

## Riscos remanescentes

- **L1:** a jornada completa dirigida não foi automatizada (ver roteiro manual).
- **Android físico:** desempenho, temperatura, toque real, custo do checkpoint (≈ 5,4 ms no Node desktop para um save de ≈ 182 kB, até ≈ 1,5 gravação/s no pico de trabalho da base) e quota de `localStorage` não foram medidos.
- **Fonte econômica D07** a confirmar (AC-22).
- **Marcas anti-reversão ilegíveis** fazem a carreira parar de gravar (falha fechada, avisada).
- **Não persistidos:** a fila das lojas, os pedestres e o trânsito (recriados) e a tampa aberta do porta-malas.
- Nomes, cores e equipamentos provisórios; casas sem interior (B1-02); retorno doméstico completo (B1-09).

## Roteiro manual de playtest (Galaxy S24 / Chrome Android, pelo usuário)

Usar a prévia isolada do PR (Cloudflare Pages do SHA final) em paisagem, sem `?dia`/`?devtime`.

1. **Menu:** tela inicial → Novo jogo → Lia → aparência e equipamento → Iniciar → **carro**. Confirmar que o menu não aparece por cima do jogo.
2. **Coleta dirigida:** dirigir o carro até a 1ª loja do objetivo, estacionar, sair, Retirar com o funcionário, abrir o porta-malas, Guardar; repetir na 2ª loja. Observar se as caixas aparecem e não se atravessam.
3. **Base:** voltar pela portaria, estacionar numa vaga de carro (dirigindo), descarregar em viagens até o conferente. Depois, **fechar o Chrome à força** e reabrir → Continuar: os volumes e as caixas devem estar exatamente onde estavam.
4. **Triagem e saída:** aguardar a saca do setor, levá-la ao porta-malas, liberar a equipe junto ao carro.
5. **Entregas:** dirigir parada a parada; em algum endereço sem ninguém, registrar a tentativa. Passar das 21h e de 00h (pode usar Aguardar quando houver); conferir o atraso no painel de Logística.
6. **Devolução:** voltar à base, devolver ao conferente de plantão.
7. **Fim:** quando o objetivo for "Voltar para casa", dirigir até a casa, estacionar, ir a pé até a porta e tocar em Encerrar o expediente. Conferir o cartão com os ganhos (D07) e o menu: dia seguinte e as outras carreiras livres.
8. **Repetir com a moto** (outra carreira), incluindo uma pausa e o fechamento do Chrome no meio da rota.
9. **Opções → Gerenciar saves:** exportar a carreira fechada; tentar importar e apagar durante um expediente aberto (deve recusar).
10. **Anotar:** FPS percebido, aquecimento, toques perdidos, travamentos no trânsito, textos cortados.
