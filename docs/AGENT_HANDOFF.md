# Handoff — Brejo Alegre Web Lab principal (W009)

**Atualização 12/11/2026 — separação solicitada pelo usuário.**

## Identidade e fonte da verdade

O repositório `raff1play/BrejoAlegre-WebLab` contém um protótipo 3D **single-player no navegador**, Babylon.js + TypeScript + Vite, para avaliar direção, controles e visual. O **jogo definitivo Godot/Android com multiplayer e logística** continua previsto em `docs/product/ORIGINAL_GODOT_SPEC.md`, mas ainda não foi desenvolvido.

Leia `AGENTS.md` → `docs/00_START_HERE.md` → `docs/DECISIONS.md` → `docs/product/WEBLAB_SCOPE.md` → `docs/product/ORIGINAL_GODOT_SPEC.md` → `docs/PROJECT_STATE.md` → `docs/NEXT_TASK_FOR_FABLE.md`. Nunca deduza funcionamento de screenshots de IA ou de CI verde.

## Nova linha principal — W009

- **Branch:** `feat/weblab-core-w009`; **PR #2** em rascunho contra `main`. Base recuperada do commit `bc453402c928816512d7ebaddc6d066bf24e126c` (W009).
- **O que existe:** moto e entregador articulados, controles de teclado e analógico para Android, direção W008, caminhar/montar/desmontar, câmera, colisão, cena fictícia com dez casas, mercearia e vitrine de cinco fachadas detalhadas, dois perfis gráficos e HUD FPS.
- **Testes documentados da W009:** 47/47 unitários; 44/44 verificações em Chromium headless após W009-B (logs `docs/evidence/e2e-staging-w009-*.log`); CI de `bc453402` success, run `43135252554`. Não há prova de FPS, termal, qualidade visual nem ergonomia no Galaxy S24 físico.
- **Deploy:** W009 esteve publicada no GitHub Pages, mas o Pages foi posteriormente atualizado para W012. A nova branch W009 limpa **não foi publicada**; não usar a página atual como evidência da W009 limpa.

## Experimento descartado — NÃO misturar

O Easter egg W010–W012 (dragão, sons, fogos e GLB Ashwing) fica apenas na antiga branch `setup/weblab-foundation`; PR #1 foi **encerrado sem merge**, preservando todo o histórico. O usuário decidiu não usar esse evento. Não copiar, importar, reverter para essa branch, nem trazer suas dependências para a linha principal sem novo pedido explícito.

A `main` permanece no commit inicial. Não realizar merge, deploy, contratação ou alteração de outros projetos sem autorização.

## Próxima tarefa

Continuar a partir da **W009 limpa**. Validar joystick W008 e direção no celular, aparência/animações da W009, colisões/câmera e FPS nos perfis leve/alto; corrigir problemas reais antes de expandir. Atualizar `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md` e `docs/CHANGELOG.md` por mudança, com SHA, CI, capturas/logs e testes **de fato executados**. Ver `docs/NEXT_TASK_FOR_FABLE.md`.
