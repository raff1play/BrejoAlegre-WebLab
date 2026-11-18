# B1-01 — F1: identidades, carreiras e saves versionados (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (base `preview` @ `2b09864`). **Status:** F1 entregue para revisão técnica. **B1-01 NÃO está concluído**: F2–F7 não foram iniciadas. **NÃO PUBLICADO.** Este documento não altera as 17 decisões nem AC-01–AC-26, nem `docs/beta1/STATE.json`.

## O que a F1 implementa

| Contrato | Arquivo | Conteúdo |
|---|---|---|
| C1 — identidade | `src/core/career/careers.ts` | `CareerId` persistente (`personagem-norte/oeste/leste/sul`) separado de `ActorId` (`jogador/npc1/npc2/npc3`); um personagem por setor; `HomeId` fixo por personagem; presets `masculino/feminino`; catálogo provisório de equipamentos; `VehicleKind` `moto-antiga/carro-antigo`; `buildRoster(ativo)` mapeia **um e somente um** personagem para `jogador` |
| Casas | `careers.ts` (`HOME_LOTS`, `homeOf`) | Quatro lotes residenciais reais (GEO_LOTS uso `casa`) fora dos 48 endereços de entrega, no interior do próprio setor; âncora `door` (calçada) e `stop` (leito da rua), alcançáveis pela malha viária. Interiores e rotina das 11h30 = B1-02 |
| C5 — snapshot | `src/core/career/snapshot.ts` | Save de **uma** carreira, `schemaVersion: 1`, `format: brejo-alegre-carreira`, `checkpointSequence`, perfil, expediente opcional, JSON canônico e checksum FNV-1a. Valida tudo antes do uso; rejeita versão futura/antiga, corrupção, casa/setor reatribuídos, veículo de outra carreira, roster divergente, pacote duplicado, estado divergente do histórico, pagamento duplicado ou de tipo ≠ `ENTREGA` |
| C4 — expediente (estrutura) | `snapshot.ts` (`ShiftSnapshot`) | `shiftId = <careerId>/dia-<índice>`: derivado do dia de calendário, não da hora (00h não cria novo expediente); `elapsedVirtualMinutes` (≥ 0), `roster`, cópia profunda dos `Parcel`, `payments` idempotentes, `lateByActor`, `safePoint` |
| Armazenamento | `src/core/career/careerStore.ts` | Uma chave por carreira (`brejo-b1:carreira:<id>`), cópia íntegra anterior (`…:anterior`), sequência que não retrocede, falha de gravação → `SaveError` sem perder o save anterior; troca de carreira recusada com `activeShiftId` aberto; backup export/import validado antes de qualquer escrita |
| Isolamento NPC | `CareerSession` | Único caminho de escrita do jogo; grava só a carreira ativa; as outras três são somente leitura (`peek` congelado) |
| Legado | `careerStore.ts`, `careerBoot.ts` | `brejo-log003-workday-index` vira o `calendarIndex` da carreira Oeste, **sem ser apagado**, e continua espelhado (rollback para builds anteriores). Sem nenhum save, a carreira ativa é Oeste: comportamento atual preservado |
| Integração | `logisticsDay.ts`, `deliveryGame.ts`, `workday.ts`, `hudContext.ts`, `minimap.ts`, `main.ts` | Setor do jogador, equipe NPC (nome/setor) e balcão de retirada vêm do roster; com o roster padrão, textos, docas, vagas e equipe são idênticos ao legado. `main.ts` lê/grava o dia pela sessão da carreira |

## Decisões de engenharia (auditáveis, não são decisões de produto)

- **Nomes provisórios:** Rosa (Norte), Caio (Leste) e Davi (Sul) mantidos dos NPCs existentes; **Lia** (Oeste) é provisório. Nomes finais estão fora do escopo congelado; os IDs não dependem dos nomes.
- **Equipamentos:** catálogo provisório `kit-jaqueta` / `kit-refletivo` apenas para estruturar AC-02; o catálogo final não foi decidido.
- **`localStorage` síncrono** atrás da interface `KeyValueStorage` (cada `setItem` é atômico). IndexedDB continua possível sem mudar o schema.
- **Checksum FNV-1a** detecta corrupção/edição acidental; não é proteção criptográfica contra fraude.
- **Saldo** em centavos inteiros iniciando em 0; nenhuma tabela de valores nova foi criada.
- **Dev `?dia=N`:** o avanço de dia não retrocede mais o calendário salvo (antes, o índice legado podia voltar).

## O que NÃO está na F1 (pendências explícitas)

- **Tela de escolha de personagem / troca de carreira na interface** (AC-17 completo) e escolha do veículo na interface: o domínio existe e está testado; a UI fica para quando o carro for jogável (F2) e o fim de expediente válido existir (F5/F6). Hoje o jogo sempre abre a carreira ativa salva (padrão Oeste).
- **Aplicação visual** dos presets masculino/feminino e equipamentos no modelo 3D.
- **Carro jogável** (F2), porta-malas/caixas (F3), logística do carro (F4).
- **Resultado `DEVOLVIDO_E_CONFERIDO`, 21h/00h, plantão, atrasos** (F5): a estrutura do snapshot já reserva `lateByActor` e `payments`, mas os cortes `hour<21`/`hour>=21` continuam no código.
- **Checkpoints durante o expediente, retomada no ponto seguro, reconstrução de NPCs/trânsito, política de conflito de backup com o ledger** (F6). Hoje só o avanço de dia é gravado, como no legado.
- Teste em Galaxy S24 físico: somente pelo usuário.

## Correções da auditoria F1 (PR #15, comentário 6899479417)

| # | Defeito | Correção | Teste |
|---|---|---|---|
| 1 | Sessão desatualizada (outra aba, backup restaurado) podia gravar checkpoint **maior** com dados **mais antigos** | `CareerStore.commit` exige `baseSequence` igual ao checkpoint gravado; `write` aceita só `gravado + 1` (sem salto). `CareerSession` guarda sua base e recusa toda escrita depois que o armazenamento avança, até `reload()`. Política de múltiplas abas: a primeira gravação vence, as demais sessões são recusadas como desatualizadas, sem mescla automática | `tests/b1-01-audit-fixes.test.ts` (Auditoria 1) |
| 2 | Perfil e expediente aberto podiam estar em dias diferentes; `commitNextDay` avançava com expediente aberto | Schema exige `profile.calendarIndex === shift.calendarIndex` com expediente aberto; `commitNextDay` recusa enquanto houver `activeShiftId`/`shift` e grava o novo dia com `shift: null`. Cruzar 00h mantém o mesmo `shiftId` e não avança o dia | Auditoria 2 |
| 3 | Schema aceitava pagamento de `ENTREGA` para pacote não entregue | Pagamento só para pacote `ENTREGUE` em `destinatario`; `eventId` derivado (`<shiftId>/<parcelId>/ENTREGA`), logo no máximo um por pacote e expediente; `COLETA`/`DEVOLUCAO` e qualquer outro tipo são recusados (nenhum outro evento remunerado foi aprovado). `DEVOLVIDO_E_CONFERIDO` ainda não existe no fluxo (F5): um save com esse estado é rejeitado por inteiro | Auditoria 3 |
