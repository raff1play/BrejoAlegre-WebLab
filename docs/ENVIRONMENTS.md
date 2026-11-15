# Ambientes e deploy

| Branch | Finalidade | Verificação | Publicação |
|---|---|---|---|
| `preview` | integracao e teste publico | CI de PR + gates completos antes do deploy | Pages em push de codigo do jogo apos testes verdes; ou gatilho manual legado. Docs e estados isolados nao publicam |
| `main` | baseline validada | CI + PR | `pages.yml`, **manual**, nunca automático |
| `archive/2026-11-15-log006-published` | recuperação histórica | nenhuma | nunca publicar |
| `chore/*`, `fix/*`, `feat/*` | alterações isoladas de risco | CI + PR para preview | nunca publicar diretamente |

O GitHub Pages usa apenas **um endereço**: https://raff1play.github.io/BrejoAlegre-WebLab/. Publicação de `main` sobrescreveria a `preview`; **não** executar sem autorização. A produção web e o Web Lab são simulação estática, sem conta, servidor ou assinatura de hospedagem.

Marcadores públicos `VITE_GAME_ENV` em `.env.development`, `.env.staging`, `.env.production`; não armazenar senhas.

Beta 1.0: veja `docs/beta1/STATE.json` e `docs/beta1/B1_00_RUNBOOK.md`. Aprovacao de CI nao equivale a APROVO do usuario. Configuracao administrativa de branch protection deve ser feita separadamente; o workflow de deploy ainda bloqueia publicacao em caso de erro. Recuperação de código antigo pelo Git `archive`, não por builds paralelos.
