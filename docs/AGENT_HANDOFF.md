# Handoff atual — Brejo Alegre Web Lab

**12/11/2026 — política permanente de duas branches aprovada pelo usuário.**

## Identidade

Repositório: https://github.com/raff1play/BrejoAlegre-WebLab
Web Lab: Babylon.js + TypeScript + Vite, single-player, cena fictícia de testes no navegador. O jogo final Godot/Android e sua especificação continuam **separados** e ainda não estão implementados. Leia `AGENTS.md`, `docs/WORKFLOW.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATE.md` e `docs/product/WEBLAB_SCOPE.md` antes de alterar.

## Código vigente

- Branch ativa: `preview` criada do commit `bf8881e514e7f6e6a451a299de262197ef1e1271`, com W009, CORE-010, CORE-011 e CORE-012.
- `main` permanece no commit inicial até o PR consolidado ser revisado e aprovado.
- Assets Poly Haven CC0 estão documentados em `public/assets/ASSET_MANIFEST.md`; câmera GTA/ISO, joystick, piloto e pedestre preservados.
- Experimento **descartado** W010–W012 do dragão constava da antiga `setup/weblab-foundation`, **excluída em 12/11/2026**; PR #1 permanece fechado. Não recuperar nem copiar o evento para `preview`.
- PRs encadeados #2–#5 foram fechados **sem merge**, substituídos pelo PR consolidado **#6** (`preview` → `main`, em rascunho). Suas branches foram excluídas; os commits das etapas principais permanecem no histórico da `preview`. Não são base para próximas alterações.

## Passos em toda tarefa

1. Trabalhar **diretamente em `preview`** com commits claros; usar branch separada só para alterações arriscadas/isoladas.
2. A CI valida cada push da `preview`. Executar `validate:repo`, unitários, TypeScript e staging; testes Playwright adicionais quando possível.
3. Não publicar automaticamente. Só após pedido do usuário registrar autorização/commit em `docs/PREVIEW_DEPLOY_TRIGGER.md` e conferir deploy `success`. O ambiente `github-pages` precisa permitir `preview` uma única vez.
4. Para tornar `main` estável, revisar PR consolidado e confirmar aprovação antes do merge; só depois encerrar PRs antigos como substituídos.
5. Atualizar estado factual e riscos. Reportar arquivos/commits/CI, navegador, Android real, métricas e limitações sem extrapolar.

**Pendências de validação:** transição GTA/ISO e oclusão em ambiente real, FPS e ergonomia no Galaxy S24. Nenhum resultado de Chromium headless substitui teste real.
