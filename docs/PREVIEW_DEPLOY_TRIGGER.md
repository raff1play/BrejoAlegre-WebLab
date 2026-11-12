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

## Preview autorizado — W008, direção mais leve (11/11/2026)

- Usuário testou W007 e relatou "Ficou muito pesado, difícil manobrar a moto". Autorização de atualização funcional para calibrar condução e publicar no mesmo ambiente experimental já utilizado.
- W008 melhora resposta do analógico e calibração de esterço da moto, sem modificar caminhada, velocidade máxima, câmera, PWA, main ou recursos pagos.
- A CI da HEAD `652a7e84d28e19514bc3622ea9cc17f5197ae626` passou em `43118499685`: 44/44 testes e build de staging.
- Este commit no arquivo de trigger aciona o deploy do preview. Validar execução do workflow da HEAD e sucesso antes de afirmar que está publicado.

## Publicação autorizada — W009 Visual Showcase (12/11/2026)

- Usuário solicitou publicar agora a versão W009 para testar no celular. Esta aprovação vale **somente para o preview gratuito** do GitHub Pages na branch `setup/weblab-foundation`, não autoriza merge na `main`.
- Conteúdo: entregas A (moto e entregador detalhados/articulados) e B (cinco fachadas e melhorias no cenário), mantendo direção W008 e PWA desativado.
- Head W009 validada previamente: `d359a264347386e3c13242647f25ab278dd13e8a`; runs CI `43133314925` e `43133308730` concluídas com sucesso, 47/47 testes.
- Este commit aciona o workflow explícito de preview. Confirmar conclusão do deploy, commit publicado e URL efetiva; não afirmar que o Galaxy S24 foi testado.

## Publicação do experimento W010 — dragão opcional e fogos (11/11/2026)

- Autorização do usuário: deseja testar evento visual temporário ao atingir 45 km/h, com opção de reversão fácil. Somente prévia existente do GitHub Pages; sem merge `main`.
- O evento só aparece com `?dragon=1`. A URL comum e `?dragon=0` não carregam o módulo opcional.
- Implementação reversível concentrada no commit `d4b13a87d5d32f1192fb88939a1cdbc81c8c4bb0`, incluindo documentação e testes.
- CI da implementação: workflow `43138560145` terminou **success**, 51/51 testes unitários, TypeScript e build staging aprovados.
- O presente commit dispara a publicação do preview W010. Após a execução, verificar o deploy e a URL; Android/FPS/visibilidade reais permanecem pendentes.

## Publicar W011 — som e dragão sombrio apenas no Easter egg (12/11/2026)

- Pedido do usuário: incorporar rugido, fogo, explosões, quack-quack de pato, som de moto e melhor aparência do dragão, **exclusivamente em `?dragon=1`**, preservando todo o restante. Publicar no preview já aprovado para teste; `main` intocada.
- Implementação W011: nova classe `dragonAudio.ts` com áudio original Web Audio desbloqueado pelo usuário; `dragonSurprise.ts` com escamas, asas nervuradas, mandíbula/dentes, garras, fumaça, iluminação e partículas mais expressivas.
- Arquivos de física, controles, câmera e cena normal não alterados. A URL sem parâmetro não importa o módulo Easter egg.
- CI da HEAD `e4a4fdbf17ac5d15852f439a2934a8c6c207d696`: [43142045656](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43142045656) **success**; 52/52 testes, TypeScript e build staging aprovados. Teste Android e avaliação da qualidade sonora/visual continuam pendentes.
- Este commit aciona exclusivamente o deploy do preview GitHub Pages. Confirmar sucesso do workflow antes de informar publicação.

## W012 — Seletor de GLB local para o Ashwing Drake Lite (12/11/2026)

- O usuário enviou seu ZIP do Ashwing Lite para integração/teste do dragão realista. Publicar **somente a opção de seleção local do modelo** na versão experimental `?dragon=1`, preservando o jogo padrão, a branch `main` e o PR #1.
- A licença do ZIP não permite republicar o GLB como asset isolado; **nenhum GLB/FBX foi adicionado ao repositório ou Pages**. Usuário seleciona o próprio arquivo por file picker, processado diretamente no navegador.
- Código W012: commit `afe1b1011bf63d53a3b81150853e07482b3e7309`; correção TypeScript `707e645894fcb4ddc84fb82b0d358424802d5e12`.
- CI `43144504433` **success**, 53/53 testes unitários e build staging aprovado. Teste real de carregamento e execução do GLB no Galaxy S24 continua pendente.
- Este commit é o disparo do preview. Confirmar resultado da publicação antes de informar o link como atualizado.
