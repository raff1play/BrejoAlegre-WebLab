# Preview público autorizado — Web Lab 0.1

**Autorização do usuário:** 11/11/2026, pedido explícito: "Você consegue publicar?". Escopo: publicar gratuitamente uma prévia de testes do Web Lab 0.1 no GitHub Pages, **sem merge na main** e sem alterar o workflow de produção em `.github/workflows/pages.yml`.

## Estrutura

- Branch de origem: `setup/weblab-foundation` (PR #1 permanece em rascunho).
- Workflow independente: `.github/workflows/preview.yml`.
- Disparo intencional: somente alterações em `preview.yml` ou `docs/PREVIEW_DEPLOY_TRIGGER.md` feitas nessa branch. Outras mudanças de código não publicam automaticamente.
- Build: `npm ci` → `validate:repo` → `test:unit` → `build:staging` → deploy Pages.
- Nenhuma chave/conta de hospedagem adicional nem gasto autorizado.
- O site do Pages é público. Não enviar credenciais, dados pessoais, marcas de terceiros ou informações sigilosas.
- Não confundir CI verde com site acessível. Confirmar status de deploy e resposta da URL pública antes de marcar como PUBLICADO.

## Possível requisito manual

Se a etapa `actions/configure-pages` ou `actions/deploy-pages` falhar por Pages não habilitado, abrir:
https://github.com/raff1play/BrejoAlegre-WebLab/settings/pages

Em **Build and deployment > Source**, selecionar **GitHub Actions** e salvar. Então reeditar `docs/PREVIEW_DEPLOY_TRIGGER.md` (ou o workflow) para disparar nova tentativa. A integração ChatGPT/GitHub pode não ter permissão administrativa para habilitar Pages pela API.

## Critério de aceite

- Deploy do workflow concluído com success.
- URL `https://raff1play.github.io/BrejoAlegre-WebLab/` realmente carrega o jogo (não só um 404 ou HTML de erro).
- Teste pessoal no Chrome Android, com FPS registrado e reportado.
- PR #1 continua aberto, main intocada, sem merge.

**Importante:** a nova publicação é um preview; a política de deploy estável de `.github/workflows/pages.yml` não foi revogada.

## Nova tentativa após ativação do Pages

- 11/11/2026: usuário confirmou visualmente Source = GitHub Actions no repositório. Uma tentativa de reexecutar a execução antiga terminou antes de iniciar um runner; será feita tentativa nova a partir da HEAD atual para distinguir erro de configuração anterior de restrição do ambiente.

## Publicação autorizada — botão horizontal

- 11/11/2026: usuário pediu adicionar ao jogo um botão para solicitar modo horizontal ao iniciar no celular.
- Esta atualização dispara o workflow de preview existente para tornar o recurso disponível no Pages, sem merge na main.
- Critério: publicar somente se instalação/testes/build e deploy passarem. A rotação real continua dependendo de suporte do Chrome/Android, com fallback manual.

## Publicação autorizada — PWA instalável (11/11/2026)

- Pedido atual: transformar o Web Lab em PWA para abrir pelo ícone Android e evitar o aviso cinza do fullscreen via aba Chrome.
- Publicar **apenas** o preview `setup/weblab-foundation`, sem merge `main`, sem alterar domínio, sem serviços pagos.
- Verificação de código antes deste trigger: run CI `43047036838` **success**, 38/38 testes, build staging. Depois do trigger, validar a CI e o workflow do commit final.
- Após publicação, confirmar deploy GitHub Pages e manifest/ícones. Não declarar teste Android como feito sem evidência do usuário.

## Publicação de testes — W007: navegador e analógico (11/11/2026)

- Usuário pediu **suspender a instalação PWA** e substituir setas por analógico virtual proporcional. Publicar estas alterações no preview gratuito do GitHub Pages, preservando `main` e o PR #1.
- Evidência anterior a este trigger: CI da HEAD `a3e54d57a39a81e26a81e2bca7fcdb0792689da9` finalizou **success** (runs `43050655204`, `43050667863`).
- A nova publicação terá: remoção da instalação PWA, limpeza restrita de cache/SW antigo, joystick X para esterço na moto e X/Y para caminhar em 360°, freio/acelerador à direita e teclado preservado.
- Verificar o workflow da nova HEAD e registrar SHA efetivamente implantado. Teste de sensibilidade e controle por toque no Galaxy S24 permanece pendente.
