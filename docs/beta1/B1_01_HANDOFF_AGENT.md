# B1-01 — Transferência operacional para Claude Code / Codex Cloud

**Repositório:** `raff1play/BrejoAlegre-WebLab`  
**Ramo de integração:** `preview`. **Ramo futuro de trabalho:** `feat/beta1-01-carreiras`.  
**Estado do handoff (15/11/2026):** preparado, **não iniciado**. `B1-00=APROVADO`; `B1-01=PENDENTE` em `docs/beta1/STATE.json`. Nenhum agente Claude/Codex foi iniciado a partir deste documento.  
**Objetivo:** tornar o início, a execução supervisionada e a auditoria do B1-01 reproduzíveis **sem reabrir** decisões do usuário.

## 1. Fontes normativas — leia antes de qualquer alteração

Leia integralmente, nesta ordem, **sempre na HEAD atual de `preview`**:

1. `AGENTS.md` — contrato de engenharia e veracidade.
2. `docs/WORKFLOW.md` e `docs/beta1/B1_00_RUNBOOK.md` — processo de branch, gates, aprovação, rollback.
3. `docs/beta1/STATE.json` — estado **operacional autoritativo** dos módulos.
4. `docs/BETA_1_0_SPEC.md`, **seção B1-01**, inclusive **17 decisões congeladas e AC-01 a AC-26**.
5. `docs/BETA_1_0_DECISIONS.md`, seção B1-01 — respostas expressas do usuário.
6. `docs/beta1/B1_01_CONTRATOS_INTEGRACAO.md` — contratos C1–C5 e divisão F1–F7.
7. `docs/QUALITY_GATES.md`, `docs/ARCHITECTURE.md` e `docs/PROJECT_STATE.md` para contexto, distinguindo dados históricos da situação atual da branch.

**Precedência:** decisões e AC congelados > propostas técnicas do documento de integração > código legado. Para status de B1-00 e B1-01, `STATE.json` supera observações históricas nos documentos que ainda dizem “B1-00 pendente”. **Não “corrija” regras aprovadas silenciosamente.** Se houver incompatibilidade real, apresente evidências e peça resolução antes de alterar o contrato.

## 2. Checklist de ambiente para executor

O executor deve trabalhar em **ambiente de programação de verdade**, capaz de ler e escrever o repositório, usar git, terminal Node e abrir PR no GitHub:

- **Codex Cloud:** configurar/publicar ambiente com o repositório `raff1play/BrejoAlegre-WebLab`; definir `preview` como baseline e Node **>=22.12.0**; instalar dependências com `npm ci --no-audit --no-fund`. Conferir capacidade de executar testes e publicar commits em branch. O ambiente de nuvem é **separado** do acesso deste chat ao GitHub.
- **Claude Code (Opus):** escolher sessão **Remote** ou ambiente local de desenvolvimento com repositório clonado; selecionar modelo Opus disponível na conta e Node **>=22.12.0**. Ler `CLAUDE.md` na raiz, se presente. Não usar Claude Chat sem acesso a arquivos/terminal como substituto de Claude Code.
- **Ambos:** verificar `git status` limpo, `git remote -v`, branch base e `git rev-parse HEAD`. Registrar SHA inicial real. Não presumir que a conexão GitHub do ChatGPT ou do outro executor se transfere automaticamente.
- `npm run check` deve passar antes de tocar no jogo. E2E existente: `npm run test:e2e`; para executar localmente, pode ser necessário instalar Chromium/Playwright no executor **sem adicionar dependência de produção**. O CI de PR também executa E2E com tráfego.
- **Nunca** introduzir tokens no frontend Vite, renovar PWA antiga, reativar Easter Egg/teste de evento, contratar serviços, ou usar credenciais de produção.

## 3. Trava de início e propriedade das branches

1. **Esta transferência não equivale a autorização para programar.** Quando o usuário der o comando explícito de iniciar o B1-01, o coordenador registra `B1-01 -> EM_DESENVOLVIMENTO` em `docs/beta1/STATE.json` na **`preview`**, conforme `scripts/beta1-control.mjs`. Antes disso, parar no pré-diagnóstico; não começar F1.
2. Só **depois de confirmar** o estado `EM_DESENVOLVIMENTO` na `preview`, criar `feat/beta1-01-carreiras` a partir de sua HEAD. Usar uma única branch para F1–F7, commits pequenos e um **PR draft** para `preview`.
3. A branch de gameplay **não modifica** `docs/beta1/STATE.json`. Status, aprovações e rejeições são registrados pelo coordenador na `preview` com evidência e decisão humana.
4. Não dar merge, não iniciar B1-02, não publicar `main`, não habilitar auto-merge, não disparar a publicação manual de `main`, nem chamar um código parcial de B1-01 aprovado.
5. A `preview` publica **código do jogo** automaticamente depois do merge e das verificações de seu próprio workflow. Portanto, **nenhum merge de gameplay** sem revisão técnica e autorização de integração. Os testes de E2E Chromium não equivalem a teste no Galaxy S24 físico.
6. Se o estado, o SHA, o repositório ou as permissões estiverem inconsistentes, **parar e informar**, não improvisar uma branch diferente para contornar a trava.

## 4. Escopo do B1-01 — requisitos inegociáveis

- **Carreiras:** quatro personagens predefinidos, aparência masculina/feminina e equipamentos, casas/setores fixos, cada save independente. O personagem controlado muda de acordo com a carreira; não existe quinto personagem nem progresso dos saves inativos quando esses personagens estão atuando como NPCs.
- **Veículo:** cada carreira escolhe moto antiga **ou** carro antigo próprio/quitado; opção fixa até futura garagem. **Ambos efetivamente jogáveis no B1-01**, sem regressão do joystick da moto.
- **Carro completo:** direção, colisões, câmera, entrar/sair, estacionamento, coleta, **porta-malas que abre**, **caixas individuais realmente visíveis**, limites físicos, **arrumação automática**, transporte, recebimento e conferência na base, expedição, entrega, salvamento e custódia. Contador de itens decorativo ou carro de tráfego NPC **não** satisfaz o contrato.
- **Resultados de pacotes:** `ENTREGUE` e resultado final separado `DEVOLVIDO_E_CONFERIDO`. Tentativa frustrada sozinha é pendência; devolução física + conferência completam procedimento, **sem pagamento de entrega**. Dinheiro não duplica em recarregamento/restauração.
- **Relógio:** os **quatro entregadores** podem entregar depois de 21h, com atrasos individuais; plantão mínimo real da base fica disponível para conferir devoluções. Travessia de meia-noite **não** muda a identidade do expediente.
- **Finalização:** não encerrar antecipadamente nem liberar troca de carreira se um pacote/procedimento da operação continuar pendente; usar a etapa doméstica mínima e os IDs definidos no contrato para que o B1-09 depois expanda o retorno completo.
- **Persistência:** checkpoints após operações importantes e pausa, tentativa adicional ao sair quando possível, recuperação da última operação em ponto seguro, reconstrução dos NPCs/trânsito sem regressão de custódia, backup exportável/importável e teste de migração/versão.
- **Limites de outros módulos:** não exigir 12 lojas do B1-03, nem casas interiores completos do B1-02, nem corredor novo do B1-04, nem todos os alforjes da moto do B1-05, nem eventos narrativos avançados do B1-07/B1-08. **Isso não permite retirar a carga física avançada do carro, a base noturna ou as devoluções do B1-01.**

## 5. Plano de execução F1–F7 — uma entrega final

| Marco | Resultado obrigatório | Registros/testes mínimos |
|---|---|---|
| **F1: carreira + estado** | Separar `careerId` de `ActorId`, perfis predefinidos, setor/casa fixos, saves isolados e contrato de snapshot | Testes de isolamento dos quatro perfis, NPCs sem progressão cruzada, schema/versionamento |
| **F2: carro jogável** | Veículo neutro, carro com física/colisão/entrada/saída/câmera e controles Android; moto preservada | Regressão CTRL-002, teclado e toque, colisores sem clipping |
| **F3: porta-malas** | Porta-malas abrível, caixas 3D individuais, packing automático, capacidade física e persistência | Rejeição de excesso, nenhuma caixa interpenetrando, abrir/fechar/restaurar |
| **F4: logística completa do carro** | Loja -> carro -> base -> triagem -> carro -> destinatário com custódia e inventário únicos | Prova vertical usando pacote com ID estável e percurso físico verificável |
| **F5: tentativas + madrugada** | Devolução conferida, sem pagamento, 21h sem bloqueio, quatro entregadores e plantão noturno | Cenários 20h59/21h01/00h01, NPCs e base funcionando; relatório de atrasos |
| **F6: recuperação + finalização** | Checkpoints idempotentes, backup/restauração, último ponto seguro, impedir troca prematura | Testes de interrupção antes/depois de transferência, checksum/schema, nenhuma duplicação |
| **F7: homologação técnica** | Cobrir **AC-01–AC-26**, todos os regressivos antigos, E2E com tráfego, build, UX mobile | Tabela por AC com código do teste, execução observada, evidência, falhas e pendências |

**Cadência para minimizar retrabalho:** primeiro executar **F1**, produzir commit(s) e PR draft, passar `npm run check` e compartilhar o link com o coordenador para auditoria. Só após a revisão de F1 continuar F2–F7 na mesma branch/PR. No fim, depois de F7 e auditoria completa, o usuário testa a `preview` e decide `APROVO B1-01` ou `REPROVO B1-01`. O agente não se autoaprova.

## 6. Formato de entrega obrigatória do executor

Em cada marco, responder com:

- **Marco e status:** F1…F7, entregue / parcial / bloqueado, sem descrever como pronto o que não foi demonstrado.
- **Branch, PR draft, SHAs e arquivos alterados**, com links acessíveis.
- **Mudanças reais e consequências**, distinguindo lógica do domínio de alterações visuais.
- **Testes executados:** comandos, contagem real, logs/links de GitHub Actions e falhas. Nunca dizer “todos passaram” sem execução.
- **AC-XX cobertos**, de forma objetiva, e o que **não** está coberto.
- **Riscos e regressões**, especialmente moto/joystick, pacotes, base, relógio, estado financeiro e mobile.
- **O que precisa da decisão do coordenador ou do usuário**; parar se o contrato congelado impedir continuar.
- **Publicação:** declarar “NÃO PUBLICADO” enquanto não houver deploy GitHub Pages `success` confirmado no SHA correto.

## 7. Prompt de arranque comum às duas ferramentas

> Trabalhe em `raff1play/BrejoAlegre-WebLab`, baseline `preview`. Leia primeiro `AGENTS.md` e `docs/beta1/B1_01_HANDOFF_AGENT.md`, depois as fontes normativas referenciadas. Confirme que B1-00 está `APROVADO`, B1-01 está `EM_DESENVOLVIMENTO` no `STATE.json`, que as 17 decisões/AC-01–AC-26 estão congeladas e que você possui Node >=22.12, GitHub write e testes. Se B1-01 ainda estiver `PENDENTE`, não programe: informe que é necessário registrar o kickoff. Quando liberado, crie `feat/beta1-01-carreiras`, faça **somente F1**, com commits rastreáveis, `npm run check`, e abra PR **draft** para `preview`. Não altere `main`, não faça merge, não publique gameplay e não reduza nenhuma decisão/AC. Encerre F1 com link do PR, SHAs, testes reais, riscos e próximos passos para auditoria.

## 8. Critério para iniciar com segurança

**O processo fica preparado, mas não inicia por si só.** Ao usuário escolher Codex Cloud ou Claude Code, conectar a ferramenta ao repositório, e autorizar explicitamente a programação, o coordenador faz a transição de estado e o agente pode executar o prompt. **O GPT-6 deste chat audita PRs sob demanda quando o link/ID for compartilhado; não há acompanhamento contínuo autônomo nem sessão do Claude/Codex já iniciada por este documento.**

**Fonte de verdade do estado:** `docs/beta1/STATE.json`. **Fonte de verdade das regras:** seção B1-01 de `docs/BETA_1_0_SPEC.md`, intacta.
