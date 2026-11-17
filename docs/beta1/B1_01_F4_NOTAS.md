# B1-01 — F4: logística completa do carro (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Status:** F4 entregue para revisão técnica, conforme a liberação no comentário 6904314829 do PR #15. **B1-01 NÃO está concluído**: F5–F7 não foram iniciadas. **NÃO PUBLICADO.** As 17 decisões, AC-01–AC-26 e `docs/beta1/STATE.json` não foram alterados.

## Princípio

O carro usa **o mesmo domínio** da moto: `LogisticsDay`/`Workday` (lojas, recebimento, `DepotOperations`, sacas por setor, liberação da equipe, rota, entrega), `Parcel` (IDs, estados, custódia, histórico) e `DeliveryGame.action` (balcão da loja, mesa de recebimento, doca do setor, portão do cliente). Só o compartimento muda: o baú da moto dá lugar ao porta-malas (`CarTrunk`, F3), e todo volume entra e sai dele pelas transições do próprio porta-malas (`stow`/`take`, com arrumação e limite físico). Não há segundo inventário nem fluxo paralelo.

## O que mudou

| Item | Arquivo | Conteúdo |
|---|---|---|
| Visita à base com o carro (AC-09) | `src/core/delivery/workday.ts` (`depotVisitAllowed`, `carCornersLocal`, `carBootSpot`) | `DepotVisit.car`: o carro precisa estar parado com os **quatro cantos** dentro de uma vaga de CARRO pintada (`depotCarBay`); "parking" passa a ser a pessoa na traseira do carro. A regra da moto (vaga de moto, atrás do baú) não mudou e vale quando a visita não é de carro |
| Descarga na base (AC-09) | `workday.ts` (`unloadCarForDepot`) | Na vaga de carro, com a tampa aberta: até 4 volumes `EM_TRANSPORTE` (de cima primeiro) saem por `CarTrunk.take` para as mãos; o restante se acomoda. Depois, a mesma mesa de recebimento (`handOver`) e o mesmo `DepotOperations` |
| Carga do setor (AC-10) | `logisticsDay.ts` (`playerReady`) | A saca do setor vem da doca para as mãos (mesmo `takeSack`) e vai caixa a caixa para o porta-malas (`CarTrunk.stow`). "Pronto para sair" aceita a carga no porta-malas |
| Entregas (AC-10) | `workday.ts`/`logisticsDay.ts` (`takeFromCarForAddress`) | Com a equipe liberada, carro parado e mãos vazias: só os volumes do endereço mais próximo saem do porta-malas; entrega no portão pelo mesmo `deliver` (uma vez, `ENTREGUE` + `destinatario`). Mesma regra de horário da moto (corte das 21h revisto na F5 para os dois) |
| Interface do carro | `src/features/delivery/deliveryGame.ts`, `src/main.ts` | O bloqueio "coleta/base/entrega na F4" foi removido. `BikeSpot.kind`: a ação do baú da moto não aparece para o carro; rótulos dizem porta-malas/carro. Na traseira do carro: Abrir → Guardar (n) → na vaga da base "Retirar do porta-malas (n)" → na rota "Retirar pacote · nº X" → Fechar. Objetivos por veículo (`Workday.vehicleKind`): voltar pela entrada da base, estacionar numa vaga de carro, guardar no porta-malas |
| Fixtures de teste (somente desenvolvimento) | `src/main.ts` (`__debug`) | `parkCarNear` (deslocamento até uma calçada onde o carro cabe), `addressDoor`, `dispatchSpot` (consulta) e `worldStep` (avança relógio, trânsito, NPCs, base e lojas com as mesmas chamadas do loop de renderização, sem desenhar). Nenhum edita pacotes |

## Testes

- `tests/b1-01-car-logistics.test.ts` (5 testes):
  - visita à base com o carro: vaga de carro sim; rua, vaga de moto, carro em movimento, de dentro do carro e visita sem a marca de carro não;
  - **dia completo de carro** jogando Oeste e Leste: coleta → porta-malas (tampa fechada recusa) → descarga só na vaga de carro → recebimento → base → saca do setor → porta-malas (carga real cabe) → liberação → entregas; IDs estáveis, todos `ENTREGUE` uma vez, base sem erro, porta-malas vazio no fim; histórico exato de cada volume (`COLETADO > mãos > EM_TRANSPORTE > porta-malas > mãos > recebimento` e `EM_ROTA > mãos > porta-malas > mãos > ENTREGUE > destinatário`, ignorando só rearranjos internos registrados);
  - retirada por endereço: antes da liberação, sem freio de mão, tampa fechada, endereço inexistente e mãos ocupadas recusam;
  - regressão da moto: baú, textos e descarga nas vagas de moto.
- `tests/e2e/current-smoke.cjs` — `carLogistics` (Chromium, toque, tráfego ligado, 780×360 e 915×412): carreira de carro pelo menu; **todas as transições por toque no botão de ação**: coleta nas duas lojas designadas, abrir/guardar no porta-malas, descarga em viagens na vaga de carro da base e entrega ao conferente, pipeline da base até a saca do setor, retirada da saca e guarda no porta-malas (uma caixa por ID), liberação da equipe, e parada a parada "Retirar pacote · nº" + "Entregar nº". Confere estado, detentor, local, histórico e slot, IDs únicos do dia inteiro, layout do HUD carregado, sem erro da base.
- Limite físico com rejeição de excesso: coberto em domínio (F3, `b1-01-trunk.test.ts`), porque as cargas reais sempre cabem (calibração F3: pior carga real 217 L de 339 L).

## Pendências e limites

- **Deslocamento no E2E é fixture** (`parkCarNear`, `parkAt`, `placeWalker`) e o tempo da base avança por `worldStep`; a direção física do carro já foi coberta na F2. Não é uma partida humana completa.
- Pagamento por entrega e o ledger do expediente não estão ligados ao jogo (F5/F6); não há pagamento a duplicar ainda.
- Tentativa frustrada, devolução conferida, trabalho depois das 21h e plantão: **F5**. Checkpoint vivo do expediente e retomada: **F6** — recarregar a página ainda reinicia o dia.
- NPCs param para não atravessar uma pessoa parada no caminho deles (ex.: em pé no balcão de recebimento); comportamento herdado, igual para moto e carro.
- **Galaxy S24 físico: NÃO TESTADO.**
