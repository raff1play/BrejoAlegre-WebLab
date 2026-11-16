# B1-01 — F3.5: menu inicial, escolha dos quatro personagens e personalização

**Adendo operacional de execução (15/11/2026).** Não cria outro módulo Beta, não altera as 17 decisões nem os critérios AC-01–AC-26 de `docs/BETA_1_0_SPEC.md`; só insere um marco interno entre F3 e F4. Fonte autoritativa de status de módulo: `docs/beta1/STATE.json` na `preview`.

## Contexto verificado e decisão de publicação

- PR #15 (draft), branch `feat/beta1-01-carreiras`; a F3 foi auditada tecnicamente no SHA `b8767e668741a988100c07d2830f094b525956d6`. CI do PR `43768493838` com jobs `verify` e `browser-smoke` **success**. Teste físico em Galaxy S24 **não executado**. Não significa B1-01 aprovado.
- F3 implementou domínio do porta-malas, caixas individuais, arrumação, limite e save schema v2; não implementou coleta/base/entrega pelo carro. Essa integração permanece F4, conforme `docs/beta1/B1_01_F3_NOTAS.md`.
- **Não publicar F3 isolada na produção do laboratório.** Desenvolver e auditar F3.5, depois publicar F3+F3.5 na branch `lab/beta1-playtest` com autorização do usuário, preservando `preview` e `main`. A versão F2 do laboratório permanece no SHA `4ed0f39` até então.
- Uma verificação "Cloudflare Pages — success" apareceu no SHA da F3, indicando **possível preview de branch**; não é autorização de deploy de produção. Conferir/desativar branch previews no dashboard para evitar builds não solicitados. Não criar serviços pagos.
- Cuidado de reversão: a F3 migrou o esquema do save v1 para v2. Builds F2 antigos não sabem ler v2: antes da publicação, verificar backup, migração e que não haja descarte silencioso de dados.

## Entrega funcional F3.5 — critério de sucesso

1. **Menu principal real antes da simulação 3D**: tela responsiva horizontal e touch com título Brejo Alegre, quatro cards, status por carreira e opção de iniciar/continuar. Não carregar engine/cidade/trânsito/relógio antes de escolher; HUD/joystick invisíveis ou inativos no menu. Não reinstalar PWA nem forçar orientação sem ação do usuário.
2. **Exatamente quatro personagens já existentes** em `src/core/career/careers.ts` (`personagem-norte` Rosa, `personagem-oeste` Lia, `personagem-leste` Caio, `personagem-sul` Davi; nomes provisórios). Mostrar setor fixo, casa, veículo já escolhido e progresso **efetivamente gravado** (dia/checkpoint, saldo somente se existir). Não inventar níveis, saldo, horas, partidas salvas nem personagem extra.
3. **Personalização básica efetiva**: presets `masculino/feminino` e `kit-jaqueta/kit-refletivo` já definidos, selecionáveis e persistidos na carreira selecionada por `snapshot.customize` + `CareerSession.commit`. A escolha visual deve corresponder **também à aparência/equipamento do personagem realmente controlado no mundo** (a pé e no veículo), reaproveitando `CharacterLook`/`RIDER_LOOK`, `Pedestrian`, `Motorcycle` e `PlayerCar`; não somente mudar textos no card. Não exigir editor facial/corporal nem baixar assets pagos.
4. **Veículo inicial por carreira**: se `vehicle===null`, integrar o seletor já existente `askVehicle` e `chooseCareerVehicle`; moto antiga ou carro popular antigo próprios/quitados; se já escolhido, mostrar a opção gravada e **não oferecer nova escolha**, nem trocar gratuitamente. Sempre gerar mundo com veículo realmente salvo, não um mock de seleção.
5. **Fluxo de entrada sem duplicação**: leitura dos quatro perfis por `CareerStore.readAll()` somente leitura, menu de escolha → `CareerStore.setActiveCareer(id)` validado → `bootCareer` → customização/veículo quando cabível → `start` atual. Exigir salvamento integral das alterações aprovadas; erro de gravação deve ser visível e não mentir que a escolha foi persistida. Respeitar migração do índice legado Oeste, schema v1→v2 e saves íntegros. Não substituir `localStorage` nem criar outro banco de saves.
6. **Regra de bloqueio de troca** (decisão 8/AC-17): se a carreira ativa tem `activeShiftId` persistido, só ela pode ser selecionada para continuar, sem trocar de perfil ou apagar dados; a UI exibe motivo. Não adicionar botão para abandonar/encerrar expediente com pendências; não alterar `STATE.json`. **Limite reconhecido:** F3 não grava ainda o turno completo em jogo; F5/F6 integrarão a finalização e retomada plena. F3.5 não deve fabricar checkpoints de jornada, liberar uma troca proibida ou criar bloqueio irrecuperável de save antes de existir forma válida de encerrar.
7. **Outros três entregadores como NPCs**: continuar usando `buildRoster` e os quatro IDs estáveis; nenhuma alteração de balanço, experiência, dia ou posição de save nas carreiras inativas por NPCs da simulação corrente.
8. **Sem regressão**: preservar F1, F2 e F3, mundo/mapa, moto e carro, HUD/minimapa/analógico, tela horizontal, controle touch e lógica atual. Não antecipar F4, F5 ou F6; não alterar os critérios congelados.

## Arquitetura sugerida (engenharia, não regra de produto)

- `src/features/career/mainMenu.ts` (ou módulo equivalente): renderiza menu, navegação touch/teclado, estados e acessibilidade; sem duplicar regras do domínio.
- `src/features/career/characterPresets.ts` (ou equivalente): mapeia `appearance/equipment` para visuais existentes de rider/walker/driver. Presets devem ser compartilhados e refletidos no gameplay.
- `index.html` / `src/style.css`: overlay do menu, quatro cards, botões/telas de edição básica; funcional em viewport ~780×360 no Galaxy S24 horizontal.
- `src/main.ts`: substituir boot automático de Oeste por seleção explícita **antes de criar Babylon Engine**. Preservar escolhas salvas, fallback seguro e parâmetros de desenvolvimento existentes, sem bypass de menu por query string de produção.
- `src/core/career/careerStore.ts` e `careerBoot.ts`: reutilizar leitura e trava; mudanças pequenas e justificadas se necessárias; não redefinir `CAREER_IDS`, `DEFAULT_CAREER`, setores, casas nem estrutura de save.
- `tests/b1-01-menu.test.ts` (ou equivalente) + `tests/e2e/current-smoke.cjs`: cobrir fluxo visual e persistência, adaptar explicitamente testes antigos que esperavam início automático — **não** pular testes E2E nem liberar autostart em produção.

## Evidências mínimas exigidas

- Menu ao abrir URL limpa com quatro cards e dados corretos; toque nos quatro perfis em sessões isoladas; nome/setor/casa/carreira/veículo do mundo correspondem ao card; os três NPCs aparecem sem quinto ator.
- Novo perfil salva aparência, equipamento, escolha de veículo e read-back após recarregar; veículo não muda depois; perfil Oeste legado não é sobrescrito; três saves inativos byte-a-byte intactos.
- Quando existe `activeShiftId` válido no save, menu bloqueia alternância e continua carreira ativa sem reiniciar calendário/inventário. Saves inválidos exibem erro real, sem reset silencioso.
- Controle de menu e HUD em viewport 780×360 e outro tamanho; menus não interceptam gameplay após iniciar; moto/joystick/carro/porta-malas/F3 não regrediram.
- `npm run check`, `npm run test:e2e`, CI do PR `verify` + `browser-smoke` verdes no HEAD final. Informar contagens exatas de testes e gaps não cobertos. Android físico continua dependente de avaliação do usuário.
- Entregar commits, arquivos, screenshots de menu e personagem no mundo, evidências AC-01/02/03/16/17 na parcela cabível à F3.5; parar para auditoria **antes de F4**.

## Governança

Mesma branch `feat/beta1-01-carreiras`, mesmo PR draft #15, commits pequenos; não abrir novo PR, não fazer merge nem publicar `preview`, `main` ou `lab/beta1-playtest`. Status do B1-01 continua **EM_DESENVOLVIMENTO**. F3.5 não significa aprovação final nem substitui F4–F7.

## Adendo F3.5.1 — menu principal completo

**Adendo operacional (16/11/2026), autorizado no PR #15 (comentário 6903570909) após a auditoria aprovada da correção F3.5 (SHA `6271f55`).** Marco interno entre F3.5 e F4. Não altera as 17 decisões nem AC-01–AC-26 de `docs/BETA_1_0_SPEC.md`, nem `docs/beta1/STATE.json`.

1. **Tela principal** antes do mundo 3D com **Continuar**, **Novo jogo**, **Carregar jogo** e **Opções**, sobre o mesmo menu da F3.5 (sem outro motor de menu).
2. **Novo jogo** lista só personagens **sem nenhum dado salvo** (sem save principal/anterior, sem calendário legado, sem save ilegível); presets e veículo único como na F3.5. Com os quatro ocupados: aviso de que não há personagem livre — **nunca sobrescrever**. Sempre quatro carreiras, uma por personagem.
3. **Continuar** abre a carreira ativa **somente se ela tem save válido** (principal ou cópia anterior íntegra), respeitando `activeShiftId`/bloqueio de troca. Sem save ativo válido, orienta para Carregar ou Novo jogo; nunca inicia Oeste sozinho. Não promete retomar ponto da jornada (F6).
4. **Carregar jogo** mostra os quatro cards (carreira, setor, veículo, dia, checkpoint, status nova/corrompida/cópia anterior/calendário antigo), pelo mesmo `CareerStore`/`enterCareer`; navegar não grava; bloqueio de expediente aberto respeitado.
5. **Opções**: perfil gráfico real (`src/config/graphics.ts`, `mobile/desktop`), salvo e aplicado antes de criar o motor 3D; ajuda de controles. Nada inventado (som, nuvem etc.).
6. **Gerenciar saves, apagar carreira, sobrescrever slot, exportar/importar backup: F6.** Na F3.5.1 só aparecem como indisponíveis; nenhuma exclusão real.
7. Interface leve em Android horizontal (780×360 e 915×412), toque e teclado, Esc/Voltar consistentes, HUD inativo no menu; persistência e jogo idênticos à F3.5.
8. Mensagem correta quando o perfil é gravado mas a troca do apontador `ACTIVE_CAREER_KEY` falha (ressalva da auditoria F3.5): o perfil foi gravado e a carreira ativa continua a anterior.

**Aceite:** testes unitários de estado da tela, não sobrescrita, ausência de escrita ao abrir/navegar, bloqueio de expediente e erros de gravação; E2E por toque de Novo jogo, Continuar, Carregar jogo e Opções em 780×360 e 915×412, com as regressões F1–F3.5; `npm run check`, `npm run test:e2e` e CI verde no SHA final. Parar para auditoria antes da F4.
