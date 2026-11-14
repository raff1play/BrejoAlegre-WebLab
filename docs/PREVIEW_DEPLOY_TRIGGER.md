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

## Patch.gg — publicação do piloto autorizada em 13/11/2026

- **Autorização explícita:** usuário respondeu "Publique" à proposta de publicar o modo de comparação de ônibus e pedestre Patch.gg.
- **Branch exclusiva:** `preview`, sem merge em `main` e sem criar novas branches. Candidato anterior ao gatilho: `add2697660e2349afdf4f3bf7c0d704f15c48b1b`.
- **Verificações já aprovadas:** CI [43423845222](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43423845222): 83/83 unitários, validação e build staging; browser [43423296413](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43423296413) aprovou carregamento dos 2 ônibus e 1 pedestre em perfis mobile e desktop (emulação de software, não Galaxy S24 real).
- **Modo padrão:** endereço sem `?assets=patch` mantém CORE-014 com modelos procedurais anteriores.
- **Modo de comparação:** `?assets=patch` carrega `city-bus-49fd97.glb` (Polyfork, CC BY 4.0) e `woman.glb` (Patch/anymove, CC0), com fallback e créditos. Um NPC próximo é substituído visualmente; ônibus no trânsito conservam simulação anterior. Funcionários do galpão e das lojas não são substituídos neste teste.
- **Ressalvas:** ônibus low-poly, rodas ainda sem animação própria; personagem 6,27 MB não otimizada para uso em massa; aparência e FPS real no Android dependem de avaliação. Não declarar como substituição final nem como aprovado visualmente.
- **Condição de aceite:** etapa `Deploy preview` do workflow GitHub Pages concluída com `success`; confirmar URL divulgada. Não modificar workflow de produção.


## Publicação CORE-015 — auditoria de 13/11/2026

- **Autorização:** usuário solicitou auditar as alterações feitas pelo Claude no projeto Brejo Alegre e, se aprovadas, publicar. Publicação autorizada **somente da versão de testes na branch `preview`**, sem merge para `main` e sem workflow de produção.
- **Commit de código revisado:** `5398151203f051cd1d60b5473241131c07ba377d` (CORE-015, 13/11/2026). Nenhuma alteração no código do jogo é realizada para este disparo.
- **Verificação independente do GitHub Actions:** CI de push [43465837859](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43465837859) e CI de PR [43465852831](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43465852831), ambas concluídas com `success` na mesma SHA. Etapas: npm ci, validate:repo, testes unitários, TypeScript/build de staging, artefato de staging.
- **Auditoria de escopo:** dados OSM rastreados em `data/osm/SOURCE.json`; malha viária 1:1 da sede; as casas, lotes, lojas e galpão não são reproduções geográficas exatas. Registro de comparação em `docs/evidence/core015-mapa/`. A remoção experimental dos assets Patch.gg está no commit `1ddbd189` anterior ao candidato.
- **Limitações explícitas:** E2E 70/70 consta como evidência fornecida pelo implementador, não integra a CI padrão; desempenho, ergonomia, temperatura e câmera no Galaxy S24 real não foram verificados nesta auditoria. Esta publicação é um **preview para teste**, não aceite de produção.
- **Disparo:** a atualização deste documento ativa exclusivamente `.github/workflows/preview.yml`. Só declarar o site atualizado quando `Deploy preview` concluir com `success` e a URL pública for confirmada. Preservar as branches `preview` e `main`.


## CORE-015.1 — publicação experimental autorizada (13/11/2026)

- **Autorização:** usuário solicitou análise do que o Fable fez e publicação caso não houvesse erros bloqueantes. Auditoria aprovou **somente a atualização do GitHub Pages de testes da branch `preview`**, sem merge de `main`, sem uso do workflow de produção.
- **SHA do código auditado:** `f144da4d3c5bda05c16b97d5180a53c594f7ed00` (CORE-015.1: geometria e colisões, interiores das oito lojas, baú/mãos/saca, HUD/minimapa e dirigibilidade).
- **CI independente no GitHub:** [43543239571](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43543239571) e [43543246224](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43543246224), ambas `success`; log conferido com **94 testes unitários, 94 aprovados, zero falhas**, TypeScript e build staging concluídos.
- **Browser/E2E:** o roteiro `tests/e2e/play.cjs` e capturas `docs/evidence/core015-1/` foram inspecionados. **84/84** consta na documentação do implementador, porém o log `docs/evidence/core015-1/e2e/e2e-core015-1.log` mencionado ali **não consta no GitHub** e esse E2E não integra a CI. Não declarar confirmação independente desse número.
- **Pendências não bloqueantes do preview:** pequeno trecho de calçada sobreposta próximo de (−410, 9), NPCs de clientes atravessam expositor e possível câmera externa durante abertura da porta de loja. Baú abre, mas não mostra os pacotes dentro. Dirigibilidade, FPS e temperatura no Galaxy S24 físico não foram validados. A versão permanece experimental.
- **Escopo:** nenhum código da CORE-016, PWA ou piloto Patch.gg reintegrado. Publicação ocorre no Pages único; `main` permanece no commit inicial. A edição **deste arquivo** é o gatilho autorizado; a publicação só está concluída depois de `Deploy preview` marcar `success`.
