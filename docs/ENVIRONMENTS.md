# Ambientes — um código, branches permanentes

| Ambiente | Origem | Verificação | Publicação |
|---|---|---|---|
| development | `preview`, local | `npm run dev` | Somente local |
| staging | `preview` / PR | `npm run build:staging` pela CI | GitHub Pages **somente após autorização**, pelo workflow de Preview |
| production | `main` revisada | `npm run build:production` | Workflow `pages.yml` manual, sem gatilho automático |

A `main` ainda precisa receber a consolidação formal. Até lá, o site público é a última versão **explicitamente publicada** do Preview, que pode estar atrás do código de `preview`.

## Publicação controlada

- `.github/workflows/ci.yml`: executa em push para `preview` e `main`, além de PRs selecionados; testa, compila e armazena artefato. Não publica.
- `.github/workflows/preview.yml`: aceita apenas push na `preview` cujo arquivo alterado seja `docs/PREVIEW_DEPLOY_TRIGGER.md`. Roda testes e build antes de publicar no GitHub Pages.
- `.github/workflows/pages.yml`: produção manual, exclusivamente da `main`.
- O ambiente GitHub `github-pages` deve permitir a branch `preview`; essa é uma configuração manual única, não alterada pelos arquivos YAML.
- O site do GitHub Pages é o mesmo para todas as publicações, não há site paralelo de homologação.

`VITE_GAME_ENV` seleciona desenvolvimento/staging/produção no bundle (público). Não colocar senhas em variáveis Vite. Detalhes operacionais em `docs/WORKFLOW.md`.
