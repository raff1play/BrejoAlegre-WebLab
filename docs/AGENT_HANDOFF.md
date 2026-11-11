# Handoff de uma página — cole este arquivo ou leia direto do repo

**Projeto:** Brejo Alegre Web Lab (`raff1play/BrejoAlegre-WebLab`), protótipo temporário Babylon.js + TypeScript + Vite, single-player no Chrome desktop/Android. Se validado, o jogo final será REESCRITO em Godot. Não misturar os projetos.

**Não inferir de memória:** tudo que é aprovado está em `docs/product/ORIGINAL_GODOT_SPEC.md` (D01–D17) e `docs/product/WEBLAB_SCOPE.md` (prototipagem). Exceções e novas decisões em `docs/DECISIONS.md`. Status verdadeiro em `docs/PROJECT_STATE.md`.

**Escopo imediato:** uma rua fictícia em 3D, moto com controles, câmera, caminhar, colisão e visual brasileiro otimizado. Proibidos backend, multiconta, multiplayer, loja operativa, pacotes, pagamentos e mapa geográfico final nesta etapa.

**Ambientes:** `src/features/` por mecânica, `src/core/` regras puras, `src/config/` modo; dev via `npm run dev`, staging via `npm run build:staging`, produção com `npm run build:production` + deploy manual aprovado, tudo **com o mesmo src/**. `dist/` não versionado.

**Testes locais e remoto (11/11/2026):** validação dos 18 arquivos obrigatórios e 6 testes unitários passaram em Node 22.16; fontes TypeScript tiveram sintaxe verificada. A integração GitHub foi corrigida, 55 arquivos foram versionados na branch `setup/weblab-foundation` e o PR #1 foi aberto como rascunho. **Não houve** instalação npm local, typecheck completo, build Vite, teste de jogo no navegador, APK, merge nem deploy. Reinspecionar o estado do PR e a CI ao retomar.

**Instrução de próxima implementação:** `docs/NEXT_TASK_FOR_FABLE.md`. Ler `AGENTS.md` por completo. Fazer branch+PR sem merge, rodar testes reais, registrar resultados em `docs/PROJECT_STATE.md`. Não produzir só plano. Não inventar sucesso ou FPS.

**Atualização CI (11/11/2026):** a execução https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43022020392 concluiu **success**, com npm install, validação, 6 testes unitários e build de staging incluindo TypeScript. Gerou artefato; bundle principal ~7,2 MB pré-gzip, precisa otimização. Ainda não há teste real de browser/Android, FPS, merge ou deploy. Conferir CI da HEAD mais recente em cada retomada.
