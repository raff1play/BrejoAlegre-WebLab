# B1-01 — F3.5: menu principal e quatro carreiras (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Status:** F3.5 entregue para revisão técnica, conforme `docs/beta1/B1_01_F3_5_MENU_CARREIRAS.md`. **B1-01 NÃO está concluído**: F4–F7 não foram iniciadas. **NÃO PUBLICADO.** Este documento não altera as 17 decisões, AC-01–AC-26 nem `docs/beta1/STATE.json`.

## O que a F3.5 implementa

| Critério do plano | Arquivo | Conteúdo |
|---|---|---|
| 1. Menu antes da simulação 3D | `index.html` (`#main-menu`), `src/style.css`, `src/features/career/mainMenu.ts`, `src/main.ts` (`bootBrowserCareer`) | O menu abre primeiro em qualquer URL (inclusive produção; não há atalho por parâmetro). `Engine`, cidade, trânsito, relógio e `GameInput` só são criados depois da confirmação (`start()`). Durante o menu o HUD fica oculto (`body.in-menu`) e nenhum controle está ligado. PWA e orientação continuam como estavam (o botão "Jogar na horizontal" só age por toque do usuário) |
| 2. Quatro personagens reais | `src/core/career/careerMenu.ts` (`menuModel`) | Exatamente os quatro `CAREER_IDS` (Rosa/Norte, Lia/Oeste, Caio/Leste, Davi/Sul). Cada card mostra setor, rua da casa fixa, veículo **gravado** (ou "a escolher"), dia do calendário e checkpoint quando há save, "Carreira nova" quando não há. O saldo aparece só se o save existe. Leitura por `CareerStore.readAll()`: **olhar o menu não cria, migra nem reseta nada** |
| 3. Personalização efetiva | `src/features/career/characterPresets.ts`, `src/features/shared/character.ts`, `motorcycle.ts`, `pedestrian.ts`, `playerCar.ts` | `masculino/feminino` × `kit-jaqueta/kit-refletivo`, gravados por `snapshot.customize` + `CareerSession.commit`. **Um único mapeamento** (`careerLook`) veste o personagem controlado: a pé (`Pedestrian`), na moto (`Motorcycle` → `riderLook`) e ao volante (`PlayerCar` → `driverLook`). Diferenças visíveis: feminino = tronco/ombros mais estreitos, quadril um pouco mais largo e rabo de cavalo saindo do capacete; jaqueta = jaqueta preta com faixas amarelas e capacete escuro; refletivo = colete limão sobre jaqueta cinza, faixas prateadas e capacete branco. A prévia SVG do menu usa as mesmas cores. Sem editor facial/corporal nem assets externos |
| 4. Veículo por carreira | `careerMenu.ts` (`enterCareer`), `vehicleChoice.ts` (`askVehicle`, inalterado) | Sem veículo: "Iniciar" abre o diálogo F2 existente (moto antiga / carro popular antigo, próprios e quitados). Com veículo: o detalhe mostra "próprio, quitado e fixo" e não oferece escolha; pedir outro tipo é recusado (`permanece fixo`) sem gravar. O mundo é sempre construído com o veículo **lido do save** |
| 5. Fluxo sem duplicação | `enterCareer` | `readAll` (somente leitura) → toque/confirmação → `setActiveCareer` (validado) → `bootCareer` (que já persiste a migração não destrutiva do calendário legado Oeste) → **um** checkpoint com presets + veículo único (mesmas funções de domínio `customize` e `chooseStartingVehicle` que `chooseCareerVehicle` usa) → `start`. Sem mudança, nada é gravado. Qualquer erro de gravação aparece no menu ("A escolha NÃO foi gravada: …") e o jogo não começa. Armazenamento indisponível: aviso permanente no menu e no jogo. `localStorage`, schema v2 e migração v1→v2 inalterados |
| 6. Bloqueio de troca (decisão 8 / AC-17) | `menuModel` | Se a carreira ativa tem `activeShiftId` gravado, só ela fica habilitada ("Expediente aberto — continuar"); as outras mostram "Expediente aberto de <nome>: termine-o antes de trocar de carreira" e o toque não faz nada. Entrar nela mantém dia e expediente. Não existe botão de abandonar/encerrar. **Limite:** o jogo ainda não grava `activeShiftId` durante a jornada (F5/F6); por isso, no jogo normal, ninguém fica preso — o bloqueio foi testado com um save válido construído pelas funções reais de domínio |
| 6b. Save inválido | `menuModel`, `enterCareer` | Save principal ilegível **sem** cópia anterior íntegra: card desabilitado mostrando o erro real; entrar é recusado; nada é sobrescrito. Com cópia anterior íntegra: card jogável com aviso ("usando a cópia anterior íntegra") |
| 7. Três NPCs | `buildRoster` (inalterado) | Sempre os quatro IDs; o escolhido é o jogador e os outros três são os entregadores NPC. Entrar numa carreira não toca nos saves das outras (verificado byte a byte) |
| 8. Sem regressão | — | F1–F3 preservadas: todos os fluxos E2E antigos (moto, carro, porta-malas, legado) agora passam pelo menu real, sem nenhum teste pulado nem asserção afrouxada |

## Testes

- `tests/b1-01-menu.test.ts` — 7 testes:
  - quatro cards, IDs/nomes/setores/casas distintos, nada gravado ao abrir;
  - calendário legado visível por leitura pura, migrado só ao entrar, chave antiga preservada;
  - as quatro carreiras gravam presets e veículo só no próprio save, as outras byte a byte intactas, roster com três NPCs;
  - veículo fixo: troca recusada sem gravar, sem mudança sem checkpoint, presets mudam;
  - AC-17: expediente aberto bloqueia as outras sem gravar e permite continuar a mesma sem reiniciar;
  - save inválido mostrado e não resetado; cópia anterior usada com aviso;
  - mapeamento de presets: quatro combinações distintas, colete só no refletivo, figura correta.
- `tests/e2e/current-smoke.cjs`:
  - `mainMenu`: URL limpa abre o menu sem mundo 3D e sem save criado; quatro cards corretos; layout em **780×360 e 915×412** (cards lado a lado, dentro da tela, sem sobreposição, HUD oculto; botões do detalhe ≥ 40 px e na tela); ainda sem mundo durante a escolha do veículo; ao iniciar, menu some e HUD aparece.
  - `fourCareers` (780×360): as quatro carreiras em sequência, por toque, cada uma com presets e veículo diferentes. Em cada uma: mundo da carreira (nome, setor, casa), exatamente os outros três como NPCs, presets gravados **e vestidos** pelo pedestre e pelo piloto/motorista, veículo gravado; saves das outras byte a byte intactos; recarga mostra os dados de cada uma; reentrar não oferece novo veículo.
  - `lockedMenu`: save de Norte com expediente aberto (gerado por `tests/e2e/fixtures/locked-save.ts` com as funções reais) + save de Sul corrompido: só Rosa habilitada, motivo nas outras, erro real em Sul, toque em carreira bloqueada não altera nada, continuar Rosa preserva dia 3 e expediente, Sul permanece como estava.
  - Fluxos antigos adaptados ao menu: moto (Oeste), legado (card mostra o dia do índice antigo sem gravar), carro (recarga mostra o carro fixo e "Continuar carreira").

## Pendências e riscos

- **AC-02/AC-03/AC-16/AC-17 continuam parciais:** o bloqueio de troca só terá efeito no jogo quando F5/F6 gravarem o expediente aberto e a finalização válida.
- Os NPCs ainda usam o visual próprio dos entregadores (cor da moto); os presets gravados de carreiras inativas não são aplicados aos NPCs (não exigido pelo plano).
- Nomes, cores e catálogo de equipamentos continuam provisórios. A prévia do menu é um desenho 2D com as cores do avatar, não uma renderização 3D.
- Se `enterCareer` falhar depois de `setActiveCareer`, o ponteiro da carreira ativa já aponta para a escolhida (nenhum dado de perfil muda); o menu mostra o erro.
- Concorrência entre abas, `COLETA` no ledger e backup × saldo seguem abertos para F6. **Galaxy S24 físico: NÃO TESTADO.**
