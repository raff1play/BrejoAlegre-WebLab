# Início rápido — fonte atual (15/11/2026)

**Ativo:** Web Lab Babylon.js/TypeScript/Vite, navegador single-player, mapa OSM em escala aproximada à cidade real, oito lojas, jogador + três entregadores NPC, triagem e entregas reais na simulação, calendário.

Leia nesta ordem: [PROJECT_STATE](PROJECT_STATE.md) → [DECISIONS](DECISIONS.md) → [WORKFLOW](WORKFLOW.md) → [ARCHITECTURE](ARCHITECTURE.md) → [QUALITY_GATES](QUALITY_GATES.md) → [ISSUES_AND_RISKS](ISSUES_AND_RISKS.md). Confira também `AGENTS.md`.

**Começar por onde está:** a baseline atual de código é a LOG-006 publicada (commit `f98b652`); o snapshot completo anterior à limpeza fica em `archive/2026-11-15-log006-published`. Histórico antigo não é próximo trabalho. O próximo módulo aprovado para especificação é **HUD-001**; não implementá-lo como efeito colateral da limpeza.

Visão de produto futura Godot: `product/ORIGINAL_GODOT_SPEC.md`. Regras do protótipo: `product/WEBLAB_SCOPE.md`.

**Testar:** `npm ci && npm run check`; no navegador, `npm run test:e2e` com Playwright. Publicar apenas com autorização registrada no arquivo de gatilho. Em celular físico, requer validação humana.
