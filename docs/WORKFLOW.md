# Fluxo de engenharia — linha atual

- **`main`**: baseline estável de código após revisão e aprovação, nunca publicação automática.
- **`preview`**: branch permanente de desenvolvimento e fonte do GitHub Pages de testes. Alterações pequenas nela; grandes/destrutivas em branch temporária, com PR para revisão.
- **`archive/2026-11-15-log006-published`**: snapshot de recuperação, não linha de desenvolvimento. Não mesclar nem publicar.

## Caminho normal

1. Inspecionar `AGENTS.md`, estado e riscos. Reproduzir comportamento existente antes de alterar.
2. Escopo mínimo; commits pequenos; manter contratos de pacote, navegação, horas, joysticks e licenças.
3. `npm run check` (estrutura, unitários, TypeScript e build) em cada push; regressão de navegador/telemóvel conforme impacto.
4. Testes E2E verificam a experiência visual integrada; fixture de reposicionamento **não** é prova de trajeto de moto real. Não fingir teste físico Android.
5. Merge para `main` via PR; se houver falhas ou regressões não comprovadas, manter em preview.
6. Publicar `preview` somente por pedido explícito e atualização consciente de `docs/PREVIEW_DEPLOY_TRIGGER.md`. GitHub Pages tem apenas **um** site; não executar deploys alternativos que substituam o conteúdo.
7. Atualizar documentos curtos de estado, risco e decisão e registrar run CI e commit.

## Testes e recursos

- CI de push: `npm ci`, validação, unitários, TypeScript e build; sem anexar artefatos a cada push.
- E2E de browser: executar em PR de mudança arriscada ou manualmente, com Playwright/Chromium instalado no runner; verificar cenário atual e tráfego ligado.
- Arquivos históricos, provas visuais e scripts obsoletos ficam na branch de arquivo. Nunca reativar old PWA ou eventos descartados por engano.
- Nenhum backend ou serviço pago necessário para manter o site de testes.

## Segurança de publicação

`preview.yml` somente é acionado por alteração de `docs/PREVIEW_DEPLOY_TRIGGER.md` na `preview`. Alterações comuns de documentos, testes e código não acionam o Pages. `pages.yml` continua manual e restrito à `main`.
