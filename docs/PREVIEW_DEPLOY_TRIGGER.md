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

## CORE-013 — publicação de teste autorizada (12/11/2026, horário de São Paulo)

- **Pedido explícito do usuário:** "Análise o resultado e depois publique se estiver tudo correto, quero testar as novas modificações".
- **Branch permanente e única origem:** `preview`. Não fazer merge na `main`, não criar outras branches, não reativar o Easter egg ou PWA.
- **Candidato auditado:** commit `a688ec68171d7b4114b5d41d7a5e5c8e4b35966f` (CORE-013 + correção de obstáculos da câmera GTA nas áreas expandidas + testes + docs).
- **Conteúdo da prévia:** expansão fictícia inspirada no município paulista Brejo Alegre, galpão e até oito lojas, tráfego de veículos e NPCs de pedestres, semáforos, minimapa e relógio/ciclo dia-noite. O traçado real não foi comprovado; não anunciar mapa cartograficamente fiel.
- **Evidência da implementação CORE-013:** CI `43350287749` success no commit `d7b9637`, 73 testes unitários; 59/59 verificações de navegador em Chromium headless no commit anterior à correção de câmera, em `docs/evidence/e2e-core013.log`; capturas `docs/evidence/core013-*.jpg`.
- **Correção de auditoria:** `src/world/cameraObstacles.ts` expandido para galpão, árvores, postes e quarteirões. CI `43350772802` e `43350779897` success (código e novo teste de regressão).
- **Critério de deploy:** workflow `preview.yml` valida/recompila o commit efetivamente publicado antes de acionar Pages; confirmar run `success`, SHA e URL. Não declarar Android real testado; FPS/termal e comportamento dos NPCs no Galaxy S24 ainda não medidos.
- **O usuário deve avaliar:** tráfego, colisões, carros/vans/ônibus, semáforos, minimapa, câmera GTA nas novas construções, iluminação noturna, controles touch e FPS nos dois perfis gráficos.

## CORE-014 — Preview de testes autorizada em 13/11/2026

- **Autorização do usuário:** "Analisa o que foi feito e se estiver ok publique". Auditoria considerou a build apta a **teste experimental**, com ressalvas de acabamento e desempenho real.
- **Commit candidato conferido:** `9d91eb1aba3834df4434df81e273ade4a5a572a7` em `preview`. CI final [43410949374](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43410949374): `success`, **80/80** unitários, `validate:repo`, `build:staging`.
- **Navegador automatizado:** **70/70** verificações aprovadas (Chromium headless com GPU por software), conforme `docs/evidence/e2e-core014.log`. Fluxo completo de oito pacotes executou ações de negócio reais com posicionamento de diagnóstico; navegação manual da rota inteira ainda não validada.
- **Incluído:** câmera exclusiva em terceira pessoa, HUD reduzida, ampliação navegável para 38.296 m² (2,15×), 48 endereços, oito lojas com funcionário/horários, galpão com oito funções e jornada loja → galpão → residência. Preservados controles, minimapa, trânsito, dia/noite e assets prévios.
- **Limitações conhecidas:** interiores de acabamento simples, modelos de NPC/veículos procedurais, aprovação estética humana ainda pendente; precisão cartográfica 1:1 de Brejo Alegre **não** implementada; FPS/temperatura/ergonomia no Galaxy S24 **não medidos**.
- **Publicação permitida exclusivamente no Pages pela branch `preview`**, sem merge em `main`. O workflow revalida o SHA publicado; confirmar `success` e URL antes de declarar concluído.
