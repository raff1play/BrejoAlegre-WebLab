# AGENTS.md — Contrato obrigatório para qualquer IA neste repositório

**Ler antes de atuar:** `docs/00_START_HERE.md` → `docs/PROJECT_STATE.md` → `docs/product/WEBLAB_SCOPE.md` → `docs/product/ORIGINAL_GODOT_SPEC.md` → `docs/ARCHITECTURE.md` → `docs/QUALITY_GATES.md` → `docs/VISUAL_DIRECTION.md` → tarefa em `docs/NEXT_TASK_FOR_FABLE.md`.

## Identidade e limites
- Projeto **Brejo Alegre Web Lab**, protótipo SINGLE-PLAYER 3D descartável em Babylon.js + TypeScript + Vite. NÃO é a futura implementação Godot/Android, nem RadarPro/Mapa-051/SSF/Labirinto13.
- A especificação original Godot mantém a VISÃO de produto. Para o laboratório, o adendo WEBLAB_SCOPE prevalece **apenas para escolhas técnicas/plataforma**. Nunca revogar mecânicas/economia/geografia aprovadas sem decisão do usuário.
- A cena 0.1 é fictícia, rotulada visivelmente; imagens/trailers IA são REFERÊNCIAS, nunca screenshots de gameplay real. Não inventar mapa, resultados, marcas, NPCs ou FPS.

## Fonte da verdade e anti-alucinação
1. Pedido explícito do usuário **nesta tarefa**, desde que não contradiga decisão aprovada sem confirmação.
2. Decisões registradas em `docs/DECISIONS.md` e contrato em `docs/product/ORIGINAL_GODOT_SPEC.md`.
3. Exceções técnicas aprovadas para o laboratório em `docs/product/WEBLAB_SCOPE.md`.
4. Estado REAL implementado/testado em `docs/PROJECT_STATE.md`.
5. Ideias não aprovadas são `PROPOSTA` e não viram funcionalidades silenciosamente.
- Se um dado não estiver no repositório, diga **não documentado**; não deduza de conversas anteriores. Mantenha `docs/PROJECT_STATE.md` atualizado somente com fatos verificáveis, logs e URLs reais.

## Fluxo de engenharia
- **Fluxo vigente (12/11/2026):** desenvolver alterações correntes diretamente na branch permanente `preview`, com commits pequenos e CI em cada push. Não criar nova branch nem PR para cada ajuste; só abrir `feat/` temporária para mudanças arriscadas/grandes ou trabalho simultâneo. Integrar `preview` na `main` APENAS por PR revisado e aprovação explícita; publicar Pages APENAS após pedido explícito do usuário mediante alteração intencional em `docs/PREVIEW_DEPLOY_TRIGGER.md` na `preview`. Ler `docs/WORKFLOW.md`. **Easter egg W010–W012** permanece isolado em `setup/weblab-foundation`; nunca incorporar. PRs #2–#5 são histórico da transição, não a branch ativa.
- `src/features/` é código por funcionalidade; `src/world/` cenário de teste; `src/core/` regras puras; `src/config/` diferencia ambiente. Não criar um segundo jogo ou duplicar código em pasta `production`.
- `development` = Vite local; `staging` = build de PR como artefato de CI, **não site publicado**; `production` = build estático de `main`, deploy Pages apenas MANUAL e autorizado. `dist/` é saída gerada e nunca commitada.
- Componentes pequenos, TypeScript strict, cálculos puros testados, módulos separados, nenhuma chave no front-end. Não instalar dependências sem justificar licença, custo, segurança e ganho.
- Antes de mudanças: inspecionar repositório, branch, dependências e requisitos. Depois: `npm run validate:repo`, `npm run test:unit`, `npm run typecheck`, `npm run build:staging`; teste real no browser quando possível. Se falhar, reportar; **nunca simular sucesso**.
- Android exige testes com toque, horizontal, FPS, resolução, temperatura; testes feitos em desktop não valem como teste Android. Métrica alvo é 30 FPS, não resultado comprovado.
- Não acessar outros projetos ou sistemas; não contratar serviços, criar API keys, alterar permissões, ligar hospedagem, fazer PR merge ou publicar sem autorização.

## Relatório obrigatório de tarefa
`O que mudou | arquivos | comandos/testes com resultados | Chrome desktop | Android real | capturas/logs | riscos | bloqueios | branch/PR | docs atualizadas | próximo passo`.

Se houver conflito entre docs, **pare na decisão contraditória e apresente a divergência**. Para operações de implementação independentes, continue sem bloquear o trabalho todo.
