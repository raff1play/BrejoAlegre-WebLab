# Fluxo de engenharia — Beta 1.0 e linha atual

## Branches e papeis

- `main`: baseline estavel, so recebe PR e autorizacao especifica. O Pages de `main` permanece manual.
- `preview`: unica branch de integracao e fonte do site publico de testes. Preservar a ultima versao publicada com commits rastreaveis.
- `chore/beta1-00-orquestracao`: preparacao de workflow e controle, nunca gameplay.
- `feat/beta1-XX-descricao` / `fix/beta1-XX-descricao`: alteracao isolada de UM modulo, sempre abrindo PR para `preview`.
- `archive/2026-11-15-log006-published`: recuperacao historica, nunca publicar/mesclar.
- `docs/beta-1-0-blueprint`: historico da especificacao congelada. A copia aprovada deve estar em `docs/BETA_1_0_SPEC.md` na linha de integracao.

## Ordem obrigatoria para modulos B1-01 a B1-09

1. Ler `AGENTS.md`, estado e riscos. Conferir requisitos do modulo em `docs/BETA_1_0_SPEC.md` e registro de decisoes.
2. Conferir `docs/beta1/STATE.json`. Somente iniciar novo modulo se o anterior estiver `APROVADO` (e houver autorizacao explicita de desenvolvimento).
3. Registrar `EM_DESENVOLVIMENTO` na `preview`, criar branch de feature a partir dela, fazer commits pequenos sem alterar o manifesto de estado no PR.
4. Abrir PR para `preview`. CI executa estrutura, unitarios, TypeScript/build e browser E2E com trafego. Gate de PR verifica a BASE do registro, nao o registro modificado pelo autor do PR.
5. Registrar `EM_TESTES` e, depois de CI verde e revisao, integrar o PR na `preview`. Nao mesclar em `main`.
6. Push de codigo do jogo na `preview` executa o workflow Pages completo: validacao, unitarios, build e navegador com trafego ANTES de publicar. Status do deploy deve ser `success` no commit correto. Docs ou estados isolados nao publicam. O gatilho legado `docs/PREVIEW_DEPLOY_TRIGGER.md` continua possivel.
7. Com site publicado e evidencias reais, registrar `AGUARDANDO_APROVACAO`. Usuario testa no Android e diz `APROVO B1-XX` ou `REPROVO B1-XX`. Nao inventar aceitacao nem FPS de aparelho fisico.
8. Aprovar: registrar nota e evidencia do usuario, preservar SHA aprovado e liberar o proximo modulo. Reprovar: registrar motivo, reabrir o mesmo modulo, corrigir e publicar outra demonstracao. Nao saltar etapas.

## Protecoes e limites honestos

- O GitHub Pages e um unico site. Jamais executar a publicacao de `main` para experimentar um modulo.
- O B1-00 nao instala um agente Opus que inicia tarefas sozinho. GitHub Actions testa e publica; execucao de programacao continua dependente de agente externo e sua autorizacao.
- Branch protection e regras obrigatorias de merge exigem permissao administrativa (ver `docs/beta1/B1_00_RUNBOOK.md`); sem elas, o CI nao impede um administrador de clicar em Merge com erro. O workflow pos-merge, contudo, bloqueia a PUBLICACAO se os testes falharem.
- `npm run check` e obrigatorio. Browser Chromium e evidencias automatizadas nao equivalem a teste fisico em Galaxy S24.
- Nao reativar PWA/eventos obsoletos, nem criar servicos pagos ou secret dentro do Vite.
- Antes de desfazer algo, localizar ultimo commit aprovado e validar o rollback com CI.

**Manual operacional completo:** `docs/beta1/B1_00_RUNBOOK.md`. Ao terminar, informar mudancas, commits, verificacoes, problemas, estado de `preview` e `main`, publicacao real e proxima decisao necessaria.
