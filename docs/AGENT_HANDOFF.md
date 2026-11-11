# Handoff — ponto de entrada para qualquer IA

**Projeto:** `raff1play/BrejoAlegre-WebLab`, protótipo **single-player web descartável** em Babylon.js/TypeScript/Vite. Futuro jogo definitivo Godot é separado e será reimplementado se a proposta for validada.

**Contexto canônico:** `AGENTS.md` → `docs/00_START_HERE.md` → `docs/DECISIONS.md` → `docs/product/WEBLAB_SCOPE.md` → `docs/product/ORIGINAL_GODOT_SPEC.md` → `docs/PROJECT_STATE.md`. Não usar memória de conversas como requisito. Para artes, `docs/VISUAL_DIRECTION.md`. Para execução, `docs/NEXT_TASK_FOR_FABLE.md`.

**Infra e GitHub confirmados em 11/11/2026:** a branch `setup/weblab-foundation` está publicada e há um PR #1 **aberto em rascunho** contra `main`, sem merge ou deploy. A integração GitHub voltou a permitir escrita; o incidente 403 é histórico.

**Estado em 11/11/2026 (0.1 jogável):** commits `c0795b9` (lockfile + `npm ci`), `37a7d31` (jogo) e `f1615d9` (teste de navegador + capturas). CI **success** na HEAD `f1615d9` (execução 43036567194). Verificado em Chromium headless: 25 testes unitários e 44 verificações de navegador com teclado, mouse e toque emulado; capturas reais em `docs/evidence/`.

**Não testado/não medido:** Android real, toque com dedos, GPU real, FPS em qualquer aparelho, Pages. O headless usa GPU por software e seus FPS não valem como medida. Não existem física de corpo rígido, modelos 3D de arte, mapa verdadeiro nem gameplay logístico.

**Próxima tarefa:** `docs/NEXT_TASK_FOR_FABLE.md` — o usuário testa em Chrome Android real com o checklist; depois ajustar perfis gráficos e dirigibilidade com base em medição. Sem backend, sem deploy, sem merge e sem compras sem autorização.

**Handoff obrigatório:** salvar em `docs/PROJECT_STATE.md` o commit, PR, comandos realmente rodados, resultados reais, capturas do navegador, status do Android e riscos. Não alegar FPS nem testes não realizados.
