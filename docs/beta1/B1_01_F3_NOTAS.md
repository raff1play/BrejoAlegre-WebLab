# B1-01 — F3: porta-malas e caixas físicas (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Status:** F3 entregue para revisão técnica. **B1-01 NÃO está concluído**: F4–F7 não foram iniciadas. **NÃO PUBLICADO.** Este documento não altera as 17 decisões, AC-01–AC-26 nem `docs/beta1/STATE.json`.

## O que a F3 implementa

| Requisito (decisões 7 e 15, contrato C2) | Arquivo | Conteúdo |
|---|---|---|
| Local físico "porta-malas" na custódia | `src/core/delivery/parcels.ts` | Novo `ParcelPlace` `'porta-malas'`, só alcançável pelas mãos (`maos ⇄ porta-malas`), nunca direto a destinatário/base. Novo campo `Parcel.stowage` (posição da caixa: canto mínimo + dimensões ocupadas, em metros, no referencial do porta-malas), **obrigatório se e somente se** o pacote está no porta-malas. `move()` exige o slot ao entrar e o apaga ao sair; `restow()` registra no histórico o rearranjo interno (mesma custódia) |
| Dimensões das caixas | `src/core/delivery/carTrunk.ts` (`parcelSizeClass`, `PARCEL_SIZES`) | Três classes (P 22×9×15 cm, M 30×15×22 cm, G 40×22×30 cm), derivadas **somente do ID estável** (hash FNV-1a + finalizador murmur3); a mesma caixa em qualquer sessão/save. Distribuição 45/40/15 %. "Este lado para cima": as caixas só giram em torno do eixo vertical |
| Limite físico de capacidade | `CAR_TRUNK` | Volume útil 1,06 × 0,50 × 0,64 m (≈ 339 L) entre caixas de roda, assoalho → tampão, encosto → tampa traseira. Calibração de engenharia auditável |
| Arrumação automática determinística | `placeBox`, `arrange`, `arrangeAfterRemoval` | Cada caixa "cai" até apoiar (gravidade) e escolhe o espaço livre mais baixo, mais perto do encosto e da parede esquerda; exige ≥ 60 % da base apoiada. Uma caixa só é aceita se **toda** a carga resultante continuar re-arrumável do zero (4 ordens determinísticas), o que garante que retirar qualquer volume depois sempre deixa um arranjo válido. Quando o espaço livre está fragmentado, o porta-malas inteiro é re-arrumado automaticamente. Ao retirar, o restante assenta; caixas que perderam apoio são reposicionadas; em último caso, nova arrumação completa |
| Rejeição de sobrecarga sem perda/duplicação | `CarTrunk.stow` | Atômico: o plano é calculado e validado antes de qualquer mudança. O que não cabe **fica nas mãos**, mesmo estado, mesmo detentor, sem slot; nada é espremido nem descartado. Porta-malas fechado ou carro sem freio de mão: recusa sem alterar nada |
| Custódia única | `CarTrunk` | Não guarda pacotes: opera sobre a lista única do dia (`Workday.parcels`). `COLETADO` vira `EM_TRANSPORTE` ao entrar (mesma regra do baú da moto, via `advance`). Pacote de outro entregador não entra |
| Porta-malas abrível/fechável | `src/features/driving/playerCar.ts` | O compartimento foi aberto no modelo (assoalho, soleira, laterais, encosto do banco traseiro, colunas D) com o volume interno **igual** a `CAR_TRUNK`. Tampa traseira articulada na borda do teto (vidro + painel + placa + fechadura), abre ~72°. Lanternas movidas para as laterais da abertura |
| Caixas 3D individuais com ID | `src/features/driving/carCargo.ts` | Uma malha por pacote (`caixa-<ID>`), etiqueta com o ID, plataforma e classe; posicionada exatamente no `stowage` do pacote, filha da carroceria (anda com o carro). A visão **lê o domínio a cada quadro**; não tem contador nem lista própria |
| Interação (toque/teclado, mesmo botão) | `src/main.ts` (`trunkJob`) | Atrás do carro estacionado: "Abrir porta-malas" → "Guardar no porta-malas (n)" com volumes nas mãos (n = quantos cabem) → "Fechar porta-malas" / "Fechar porta-malas (cheio)". Com volumes nas mãos não se entra no carro; entrar com a tampa aberta a fecha. HUD: "n volumes no porta-malas" |
| Preparação da persistência | `src/core/career/snapshot.ts` | **Schema v2**: `ParcelRecord.stowage`. A validação rejeita (mesmo com checksum recalculado) caixas sobrepostas, fora dos limites, com dimensões erradas, sem apoio, de outro veículo/carreira, sob outra custódia, em estado que não viaja, slot em pacote fora do porta-malas e carga sem carro próprio. **Migração v1 → v2** (`SAVE_MIGRATIONS[1]`): o checksum da v1 é conferido **antes** de migrar; cada pacote recebe `stowage: null`. Ler não reescreve o save; o próximo checkpoint sai em v2 |

## Fronteira com F4/F6 (não antecipada)

- **Coleta na loja, descarga/conferência na base, retirada da carga do setor e entrega pelo carro continuam desligadas no jogo** ("Carga pelo carro: coleta/base/entrega na próxima etapa (F4)"). No jogo normal o porta-malas abre e fecha, mas só recebe volumes quando a F4 ligar a coleta pelo carro.
- `CarTrunk.take()` (retirar do porta-malas para as mãos) existe e é testada no domínio, mas **não tem botão** na F3: retirar com propósito (base ou endereço) é F4.
- **Checkpoints reais durante o jogo são F6.** A F3 só deixa a estrutura pronta e validada: o snapshot v2 grava, relê e reconstrói as posições (testado no `CareerStore` em memória e, no navegador, `__debug.cargoRoundTrip` sela/relê sem gravar). Recarregar a página hoje ainda reinicia o dia, como na F2. O estado aberto/fechado da tampa não é persistido (reabre fechada, ponto seguro).
- Fixture de teste `__debug.fixtureCollect()` (somente desenvolvimento, removido dos builds staging/produção): chama o `collect` real do domínio na loja designada (NA_LOJA → COLETADO, loja → mãos, com histórico), pulando apenas a caminhada até o balcão. Não é coleta pelo carro.

## Testes

- `tests/b1-01-trunk.test.ts` — 11 testes:
  - tamanho determinístico por ID e distribuição;
  - **capacidade calibrada contra a demanda real**: 1.030 cargas (120 dias, sorteio e limite máximo do calendário, carga de cada um dos 4 setores e a coleta do jogador) cabem inteiras, sem sobreposição; pior caso 217 L de 339 L;
  - abrir obrigatório, carro sem freio de mão recusa, slot próprio por ID, histórico, determinismo;
  - sobrecarga com 60 volumes: excedente recusado, fica nas mãos em `COLETADO`, nova tentativa não altera nada;
  - 120 sequências aleatórias de guardar/retirar: sempre dentro dos limites, apoiadas, sem interpenetração, custódia íntegra;
  - retirar caixa de baixo: restante acomodado; mãos cheias / ID estranho / tampa fechada recusam;
  - transições proibidas (sem slot, slot fora do porta-malas, porta-malas → destinatário/base, rearranjo de outro veículo); baú da moto inalterado; volume de NPC não entra;
  - persistência: ida e volta exata pelo `sealSave/parseSave` e pelo `CareerStore`; 9 formas de save adulterado rejeitadas;
  - migração v1 → v2 (save do laboratório F2), v1 adulterado rejeitado antes de migrar, store lê v1 sem reescrever e grava o próximo checkpoint em v2.
- `tests/b1-01-saves.test.ts` — três asserções atualizadas **só** pela troca de versão (1 → 2): a constante, o "versão futura" (agora `SAVE_SCHEMA_VERSION + 1`) e o texto substituído no backup corrompido. Nenhuma foi afrouxada.
- `tests/e2e/current-smoke.cjs` — nova seção `carBoot`: porta-malas começa fechado e vazio; abrir/fechar por toque; com volumes nas mãos não entra no carro; guardar por toque até esvaziar as mãos; cada ID da coleta do jogador no porta-malas com custódia/histórico; nenhum ID perdido/duplicado no dia; **uma malha por ID exatamente no slot do domínio**; nenhuma caixa atravessando outra, todas dentro do volume; HUD; ida e volta do snapshot v2 no navegador; entrar fecha a tampa; as caixas andam com o carro mantendo os slots. A verificação do save legado passou a esperar `schemaVersion === 2`.

## Riscos e pendências

- **Reversão de versão:** um navegador que abrir a F3 e depois voltar para a F2 publicada verá o save v2 como "versão futura" (a F2 não o abre e cai na cópia anterior ou num perfil novo). Só acontece se o laboratório for atualizado para a F3 e depois revertido; registrar antes de publicar.
- Tamanhos/capacidade são calibração de engenharia; o B1-05 (moto) poderá refinar classes reaproveitando o mesmo módulo.
- O custo da arrumação é de poucos ms por ação (medido ≈ 1–5 ms no Node); o rótulo do botão usa um plano em cache. Sem medição em Android físico.
- Ressalvas anteriores continuam abertas (abas concorrentes, `COLETA` no ledger, backup × saldo — F6). **Galaxy S24 físico: NÃO TESTADO.**
