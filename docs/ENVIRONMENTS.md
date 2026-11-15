# Ambientes e deploy

| Branch | Finalidade | Verificação | Publicação |
|---|---|---|---|
| `preview` | desenvolvimento e teste público | CI push + PR | Pages **somente** alterando intencionalmente `docs/PREVIEW_DEPLOY_TRIGGER.md` com autorização |
| `main` | baseline validada | CI + PR | `pages.yml`, **manual**, nunca automático |
| `archive/2026-11-15-log006-published` | recuperação histórica | nenhuma | nunca publicar |
| `chore/*`, `fix/*`, `feat/*` | alterações isoladas de risco | CI + PR para preview | nunca publicar diretamente |

O GitHub Pages usa apenas **um endereço**: https://raff1play.github.io/BrejoAlegre-WebLab/. Publicação de `main` sobrescreveria a `preview`; **não** executar sem autorização. A produção web e o Web Lab são simulação estática, sem conta, servidor ou assinatura de hospedagem.

Marcadores públicos `VITE_GAME_ENV` em `.env.development`, `.env.staging`, `.env.production`; não armazenar senhas. Recuperação de código antigo pelo Git `archive`, não por builds paralelos.
