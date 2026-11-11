# Ambientes — dev, staging e produção sem duplicar o jogo

**Princípio:** não existe uma pasta “features” executada e outra “produção” contendo segunda cópia dos mesmos scripts. O **mesmo `src/`** é compilado com configuração diferente.

| Ambiente | Origem do código | Comando | Destino | Publicação |
|---|---|---|---|---|
| `development` | Branch de trabalho | `npm run dev` | localhost:5173, HMR | nenhuma |
| `staging` | Pull request antes da `main` | `npm run build:staging` | `dist/` + artifact de CI para auditoria | **não publicado automaticamente** |
| `production` | `main` revisada | `npm run build:production` | `dist/` estático | GitHub Pages **somente se workflow manual for autorizado e habilitado** |

**Fluxo:** `feat/...` → PR → CI staging passa → revisão do usuário → merge explícito → produção manual se aprovada. `main` não é uma pasta; é uma branch estável.

## Arquivos de configuração

- `.env.development`: `VITE_GAME_ENV=development`
- `.env.staging`: `VITE_GAME_ENV=staging`
- `.env.production`: `VITE_GAME_ENV=production`
- `src/config/environment.ts`: lê o modo e marca o HUD; não contém senhas nem links secretos.

Vite injeta `VITE_*` no JavaScript público. **Nunca inserir tokens, senhas, credenciais de repositório, identificadores privados ou URLs protegidas nesses arquivos.**

## GitHub Actions

- `.github/workflows/ci.yml`: por PR e push, executa documentação + testes + build staging e guarda dist como artefato. Não faz deploy.
- `.github/workflows/pages.yml`: disparo manual, recusado fora da branch main, usa ambiente `github-pages`. Exige selecionar Actions em Settings > Pages antes de rodar.
- Aprovação de deploy/branch protection nas configurações do GitHub **não pode ser presumida** por existir arquivo YAML.
- Inicialmente falta `package-lock.json`, porque o npm registry falhou. CI usa `npm install` temporariamente; depois do primeiro `npm install` real e commit do lock, mudar para `npm ci` em ambos workflows.

## Cuidado com staging

“Build staging passou” NÃO quer dizer “testei no celular” nem “staging hospedado”. Se precisarmos de URL de homologação no futuro, isso será outra decisão com custos/segurança explicitados.
