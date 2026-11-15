# Contrato de engenharia — Brejo Alegre Web Lab

A única fonte de verdade da execução atual é esta árvore, especialmente `docs/PROJECT_STATE.md`, `docs/DECISIONS.md` e `docs/WORKFLOW.md`. Experimentos antigos estão em [archive/2026-11-15-log006-published](https://github.com/raff1play/BrejoAlegre-WebLab/tree/archive/2026-11-15-log006-published), **não** são instruções vigentes.

- **Escopo:** simulador 3D single-player de entregas no navegador com Babylon.js/TypeScript/Vite. A visão final Godot + multiplayer fica em `docs/product/ORIGINAL_GODOT_SPEC.md`, separada da implementação atual.
- **Proteger funcionalidade:** preservar física/joystick, mundo e geografia, oito lojas, três NPCs, quatro setores e docas, IDs e custódia de pacotes, calendários, prazos, controles Android. Mudança de produto depende de decisão explícita.
- **Veracidade:** somente afirmar ações comprovadas por commit, workflow e logs. Não tratar testes com tráfego desligado como prova de trânsito real. Teste no Galaxy S24 físico somente se executado pelo usuário.
- **Branches:** `preview` para desenvolvimento; `main` para baseline aprovada. Use branch isolada para alterações destrutivas. Antes de remover arquivos, garantir referência de recuperação.
- **Testes:** `npm run check` obrigatório; browser E2E para fluxos visuais, toque, horário, logística e trânsito em PRs de risco. Não diluir assertivas para aprovar build. Conferir resultados reais, não títulos de testes.
- **Publicação apos integrar B1-00:** push de codigo do jogo na `preview` inicia publicacao automatica SOMENTE apos validacao, unitarios, TypeScript/build e navegador E2E no proprio workflow. Docs/estado isolados nao publicam. Gatilho manual legado permanece. `main` continua manual e separada. Nunca afirmar deploy sem run success real.
- **Segurança e custo:** não embutir segredos em Vite, não contratar serviços, não criar dependências ou APIs desnecessárias; não ativar PWA antiga.
- **Licenças e dados:** preservar atribuições OSM/ODbL e manifesto dos assets externos CC0. Lotes/lojas/pessoas são representações fictícias.

- **Beta 1.0:** cumprir `docs/BETA_1_0_SPEC.md` e `docs/BETA_1_0_DECISIONS.md`; B1-01 possui 17 decisoes e 26 criterios congelados. Usar `docs/beta1/STATE.json` e `docs/beta1/B1_00_RUNBOOK.md`. So iniciar modulo seguinte com APROVADO explicito. O CI nao instala um agente de programacao autonomo.

Ao concluir, relatar commits e arquivos, CI/testes, navegador/Android, riscos, deploy/main e próximos passos.
