# Handoff — ponto de entrada para qualquer IA

**Projeto:** `raff1play/BrejoAlegre-WebLab`, protótipo **single-player web descartável** em Babylon.js/TypeScript/Vite. Futuro jogo definitivo Godot é separado e será reimplementado se a proposta for validada.

**Contexto canônico:** `AGENTS.md` → `docs/00_START_HERE.md` → `docs/DECISIONS.md` → `docs/product/WEBLAB_SCOPE.md` → `docs/product/ORIGINAL_GODOT_SPEC.md` → `docs/PROJECT_STATE.md`. Não usar memória de conversas como requisito. Para artes, `docs/VISUAL_DIRECTION.md`. Para execução, `docs/NEXT_TASK_FOR_FABLE.md`.

**Infra e GitHub confirmados em 11/11/2026:** a branch `setup/weblab-foundation` está publicada e há um PR #1 **aberto em rascunho** contra `main`, sem merge ou deploy. A integração GitHub voltou a permitir escrita; o incidente 403 é histórico.

**Evidência de CI pré-revisão:** na HEAD `a4201daeb50399830a318a2428076072ad44f8e0`, o workflow `43022470633` terminou **success**, com validação, 6 testes unitários e `build:staging` (typecheck + Vite). A compilação NÃO comprova execução de jogo em Chrome/Android. Após novas alterações, rever o status da HEAD atual.

**Não implementado/não medido:** experiência confirmada no browser, física realista, modelos 3D premium, mapa verdadeiro, gameplay logístico, Android real/FPS. O starter possui apenas cena provisória, moto primitiva, personagem, controles e colisão aproximada.

**Próxima tarefa:** melhorar/validar a 0.1 **na branch existente e PR #1**, a partir de `docs/NEXT_TASK_FOR_FABLE.md`. Priorizar runtime e jogabilidade, depois uma rua visualmente boa, sem web backend, sem deploy e sem compras.

**Handoff obrigatório:** salvar em `docs/PROJECT_STATE.md` o commit, PR, comandos realmente rodados, resultados reais, capturas do navegador, status do Android e riscos. Não alegar FPS nem testes não realizados.
