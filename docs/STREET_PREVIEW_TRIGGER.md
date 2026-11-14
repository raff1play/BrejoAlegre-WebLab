# Autorização de publicação: Street Preview isolada

- Solicitação do usuário: criar prévia **separada** para avaliar asfalto, faixas, calçadas, travessias, semáforos e postes, sem incorporar à CORE-015.1 antes de aprovação.
- Branch isolada: `feat/core-015-2-urban-roads-preview`.
- O workflow `street-preview.yml` recompila a versão publicada de referência **fixada em `d6eabc4909551001c3203aa4314d8c1c852ac304`** na raiz do Pages, sem editar `preview` ou `main`, e serve o experimento somente em `/street-preview/`.
- As semaforizações novas são **fictícias para fins de simulação**; o OSM sustenta a localização das ruas, mas não comprova semáforos reais.
- CI dos commits de implementação passou com 96 testes; novo workflow também valida e compila ambas as versões antes do deploy.
- Autorização NÃO inclui merge, promoção para produção, nem alterações na CORE-015.1. A prévia é provisória para avaliação.
- Publicação não deve ser declarada concluída até `deploy-street-preview` obter `success`.

- Segunda tentativa: utilizar ambiente `street-preview` porque o ambiente principal `github-pages` rejeitou a branch antes da execução do job (nenhum código da base alterado).

## 14/11/2026 — republicação das correções visuais autorizadas

- Pedido explícito nesta tarefa: publicar somente `/street-preview/` após os testes, preservando a CORE-015.1 na raiz.
- Código candidato: `c9f5c0a9e2504f53f587ffc3da703a9f11572cd0`; CI 43553014170 Success.
- 99 testes unitários, TypeScript, build staging e comparações visuais aprovados. Roteiro amplo 83/84 com redução de resolução (falha artificial de tamanho); repetição desktop sem redução 33/33, resolvendo essa verificação. Jornada completa e toque emulado aprovados. Evidências: `docs/evidence/street-fixes/README.md`.
- Base da raiz permanece fixada em `d6eabc4909551001c3203aa4314d8c1c852ac304`; nenhum merge nem push em main/preview.

## 14/11/2026 — revisão de posicionamento dos postes e semáforos

- Autorização: usuário solicitou que a correção fosse executada diretamente; publicar **somente a preview experimental** se o código e testes estivessem corretos. Nenhum merge em `preview` ou `main`.
- Código auditado: `e37f64f0391b3ccae65b01d775fefb63170572f6`; CI [43558683610](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43558683610) **success**: integridade do repositório, **101/101 testes unitários**, TypeScript e build staging aprovados.
- `src/world/city/fixturePlacement.ts`: cada equipamento de rua é testado contra pista mais próxima, calçada elevada real, colisão com edificações/muros, entradas e demais equipamentos.
- `cityLayout.ts`: postes públicos e decorativos e árvores de calçada passam a ser filtrados; visual e colisor usam o mesmo conjunto. 253 postes urbanos e 6 decorativos aprovados na área válida, em vez dos pontos inválidos anteriormente instanciados.
- `cityPlan.ts`: semáforos fictícios selecionados somente em cinco cruzamentos com espaço físico para cada aproximação. `signalFixtures.ts` corrige compensação de mão única, tenta calçadas alternativas e respeita árvores/jardineiras/postes.
- Verificação geométrica: cinco cruzamentos, 19 aproximações, **19 cabeçotes veiculares válidos**, 29 pedonais, nenhum acesso sem sinal; testes cruzam IDs com a lógica de tráfego e verificam afastamentos físicos.
- Não há evidência de medição de FPS/temperatura em aparelho Android ou nova revisão visual interativa em navegador desta revisão. A publicação é **somente para avaliação experimental**. Preservar versão estável fixada `d6eabc4909551001c3203aa4314d8c1c852ac304` na raiz do Pages.
- O commit de documentação é o gatilho de deploy; confirmar `Street Lab` `success` antes de declarar publicação.

## 14/11/2026 — GFX-001 publicada para avaliacao, isolada das demais

- Pedido explicito do usuario: publicar a ultima atualizacao do Fable para inspecao visual antes de seguir com novos assets.
- Codigo GFX-001 fixado no commit `e15c8d216a0b321bc620deff8b368420cd6a399e` (CI 43609997984: sucesso, 104 testes unitarios).
- Este gatilho instrui o workflow a montar um unico site Pages com: CORE-015.1 fixada na raiz, CORE-015.2 em `/street-preview/` e GFX-001 em `/gfx-preview/`.
- Nao altera os codigos de `main`, `preview`, da CORE-015.2 ou da propria branch GFX-001; nao ha merge. As builds sao independentes.
- Publicacao somente concluida apos o workflow de deploy terminar com sucesso; teste de acesso pelo navegador ainda necessario.

## 14/11/2026 — Publicacao ART-001 isolada para avaliacao visual

- Pedido explicito do usuario: publicar a versao ART-001 da primeira coleta e da moto, para abrir e avaliar no celular antes de aprovar o visual.
- Commit ART-001 fixado: `3931aa2acfe2fd1b59ff7c8bb37f55e9fb4c243e` na branch `feat/art-001-primeira-loja-moto` (CI 43618429126 success).
- O workflow agora empacota CORE-015.1 na raiz, CORE-015.2 em /street-preview/, GFX-001 em /gfx-preview/ e ART-001 em /art-preview/ no MESMO GitHub Pages.
- ART-001 somente para avaliacao, sem alterar `main`, `preview`, a branch GFX, nem a branch ART; sem merge.
- Considerar publicada somente apos GitHub Actions confirmar sucesso no job de deploy; desempenho Android fisico nao foi medido.

## 14/11/2026 — ART-002 — homologacao separada de galpao e fluxo fisico

- Autorizacao explicita do usuario: publicar a ART-002 para avaliacao em celular, **sem promover para a versao estavel**.
- Commit da ART-002 fixado: `190b7a09d1607273026617a83b89233dd6dff9e7`, branch `feat/art-001-primeira-loja-moto`; CI [43635815604](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43635815604) `success`, 110 testes unitarios, validacao e build.
- Criar a rota de homologacao `/depot-preview/` sem substituir CORE-015.1 na raiz, CORE-015.2 `/street-preview/`, GFX-001 `/gfx-preview/` ou ART-001 `/art-preview/`. Todos os cinco builds fazem parte do mesmo artefato de Pages.
- Nenhum merge para `main`/`preview`, nenhuma alteracao da branch da ART-002, nenhum lancamento estavel.
- Considerar o deploy concluido somente depois de `deploy-street-preview` obter `success`. Teste fisico no Android permanece pendente.

## 14/11/2026 — Correção do piso da ART-002 — homologacao

- Pedido explicito do usuario: verificar a correção da sobreposição entre grama, asfalto e concreto no pátio da base e republicar a prévia.
- Branch de desenvolvimento `feat/art-001-primeira-loja-moto`; commit corrigido fixado `731fbccbb29f2e05a5be5a7936c4312bc6c3beb8` (CI [43646227728](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43646227728) sucesso, 113/113 testes).
- Auditoria da correção: `docs/evidence/floor-fix/README.md`; remoção geométrica da grama sob o galpão, pisos principais com partição sem sobreposição e pintura com tratamento de profundidade. Desktop e móvel emulado testados, Android físico ainda não testado.
- Atualiza somente o checkout fixado da ART-002 em `/depot-preview/`, preservando a raiz e `/street-preview/`, `/gfx-preview/`, `/art-preview/`.
- Sem merge para `main`/`preview`; não modifica o código da ART-002 nem publica versão estável.
- Publicação confirmada apenas se o job do GitHub Pages concluir com sucesso.

## 14/11/2026 — correção da orientação após descarga na base

- Relato do usuário durante a homologação: após depositar os quatro volumes de coleta na bancada às 12h46, o jogo aparenta ficar parado em "Conferência no recebimento".
- Diagnóstico: a triagem inicia às 14h, o caminhão de suprimento chega às 13h e a fase CONFERENCIA ocultava o bloqueio e não oferecia botão de espera. O processamento real de volumes continua dependente de tarefas, não somente de relógio.
- Publicar exclusivamente `/depot-preview/` fixado no commit `c66a54cbf5571f35737aaa6e6aee8071ad932c92`. CI [43648300540](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43648300540): sucesso, 114/114 testes, TypeScript e build.
- Correção: progresso quantitativo do recebimento, mensagem sobre os quatro volumes do caminhão e triagem às 14h, comando "Aguardar até 14:00" quando o jogador já concluiu a descarga; teste novo de regressão.
- Não altera a logística, os IDs dos pacotes, a versão estável e as outras três prévias. Não faz merge. Teste físico no Android e avaliação da animação permanecem pendentes.
- Considerar o deploy concluído apenas com resultado success no GitHub Actions.
