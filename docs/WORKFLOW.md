# Ciclo de trabalho — humano, Fable, ChatGPT, Codex ou outra IA

## 1. Antes de implementar

- Confirmar repositório, branch e permissões; listar o que existe. Não presumir que o ZIP inicial foi publicado.
- Ler `AGENTS.md`, `docs/PROJECT_STATE.md`, escopo web e especificação.
- Formular tarefa pequena com hipótese, critérios verificáveis, o que está fora e orçamento de dependências.
- Usar branch `feat/...`, `fix/...`, `docs/...`, `setup/...`; não commitar diretamente em `main`.

## 2. Durante

- Fazer incrementos executáveis, com commits legíveis. Evitar “trocar de stack” por iniciativa da IA.
- Lógica testável isolada da renderização; telas não devem decidir dinheiro ou custódia.
- Cada novo asset exige fonte, licença, tamanho e justificativa de desempenho. Nenhuma imagem de IA é apresentada como captura do motor.
- Toda mudança de regra aprovada precisa aparecer em `docs/DECISIONS.md` com aprovação do usuário.

## 3. Critérios de qualidade

- Primeiro `npm run validate:repo`; depois `npm run test:unit`, `npm run typecheck`, `npm run build:staging`.
- Para jogabilidade, executar em browser real e registrar versão, dispositivo e problemas; documentar não executados sem mascarar.
- Colisão básica, direção e touchscreen antes de polimento visual; evitar “vídeo bonito” como evidência.
- Criar PR com template; só fazer merge/deploy com confirmação do usuário.

## 4. Encerramento e handoff

Atualizar `PROJECT_STATE.md`, `ISSUES_AND_RISKS.md` e `CHANGELOG.md`, registrando o SHA, PR, testes e próximos passos. O próximo agente deve conseguir continuar lendo só o repositório. Não se apoiar em “como discutimos no chat”.

## 5. GitHub sem permissão de escrita

Se a integração retornar HTTP 403, não insistir num loop; registrar bloqueio e oferecer push autorizado por usuário ou reconexão do plugin com escopo adequado. Não usar `main` como atalho. Não inventar URLs de PR.
