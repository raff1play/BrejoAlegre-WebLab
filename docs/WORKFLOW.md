# Fluxo permanente de desenvolvimento — Brejo Alegre Web Lab

**Decisão de 12/11/2026.** Esta política prevalece sobre instruções históricas de W009/CORE-010/011/012. Projeto atual: Babylon.js + TypeScript + Vite; o produto Godot continua separado.

## Duas branches permanentes

- `preview`: **única branch de trabalho normal**, iniciada do commit `bf8881e5` da CORE-012. Ajustes pequenos e médios são commits nela, não novos PRs ou branches.
- `main`: **versão estável**. Só recebe código após revisão de PR de `preview` para `main`, CI aprovada e aprovação explícita do usuário. Não fazer push direto nela.
- Exceção: mudanças grandes, destrutivas ou paralelas podem usar `feat/... ` temporária, com PR para `preview`; encerrar após integração.
- **Branches antigas excluídas em 12/11/2026:** `feat/weblab-core-w009`, `feat/core-010-visual-remaster`, `feat/core-011-real-assets`, `feat/core-012-gta-camera` (todas ancestrais da `preview`), e `setup/weblab-foundation` (experimento Easter egg descartado). Somente `main` e `preview` restaram. PRs #1–#5 seguem fechados sem merge; PR #6 revisa a consolidação com a `main`.

## Ciclo de cada mudança

1. Conferir HEAD de `preview`, ler `AGENTS.md`, estado, escopo e riscos.
2. Fazer uma alteração de escopo restrito diretamente na `preview`, sem reescrever outros recursos. Registrar commits claros e atualizar documentação relevante.
3. GitHub CI executa **automaticamente** em push da `preview`: `npm ci`, `validate:repo`, testes unitários, TypeScript e `build:staging`. Não interpretar CI como teste real em Android.
4. Para alterações na câmera, física, toque e visuais, executar também navegador/E2E quando disponível e solicitar validação física no Galaxy S24.
5. Informar exatamente arquivos/commits, resultados, limitações e status. Nunca afirmar que publicou sem workflow Pages concluído.

## Publicação intencional da preview (site único)

- URL: https://raff1play.github.io/BrejoAlegre-WebLab/
- `.github/workflows/preview.yml` roda **apenas na branch `preview`** e **apenas quando `docs/PREVIEW_DEPLOY_TRIGGER.md` for alterado**. Mudanças normais de código, docs ou CI NÃO publicam automaticamente.
- Depois da autorização explícita "publique": conferir CI verde da HEAD, atualizar `docs/PREVIEW_DEPLOY_TRIGGER.md` documentando autorização e SHA candidato; aguardar `Preview - Pages` `success` e confirmar URL. Esse commit de gatilho também deve passar na CI.
- O ambiente `github-pages` precisa autorizar `preview` uma única vez em **Settings → Environments → github-pages → Deployment branches and tags**. Não é necessário autorizar as próximas alterações da mesma branch.
- GitHub Pages tem **um único endereço compartilhado**; publicar a `preview` substitui a versão pública anterior. Sem publicação automática e sem serviço pago novo.

## Consolidação da main

- Criar/manter PR `preview` → `main` para revisão, mas **não fazer merge** enquanto a versão de câmera/controles mais recente não tiver validação suficiente e aprovação explícita.
- PRs antigos #2–#5 foram encerrados como substituídos e suas **branches removidas**; os commits das etapas principais permanecem no histórico da `preview`. Após merge explicitamente autorizado do PR #6, conferir CI da `main`. Não apagar `preview` nem `main`.
- O workflow `.github/workflows/pages.yml` da produção continua **manual** e limitado à `main`; não acionar sem autorização.

## Portas de segurança

- Preservar o histórico; nunca usar `git push --force` ou alterar `main` para corrigir permissões.
- Não incluir Easter egg, PWA cancelado, novas dependências/serviços ou credenciais por conveniência.
- Não inventar FPS, execução de navegador, licenças ou recursos do futuro Godot.
- Esta convenção de duas branches pode ser revista se o trabalho crescer; não deve virar uma regra que impeça branches isoladas em mudanças arriscadas.
