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
