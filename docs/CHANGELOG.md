# Histórico de engenharia (não é registro de lançamento)

## 2026-11-11 — Preparação local inicial

- Código do starter reorganizado em `src/features`, `src/core`, `src/config`, `src/world`.
- Aproximação de colisão adicionada à moto/pedestre e testes unitários puros.
- Fluxos CI staging + Pages manual, sem publicação automática.
- Contratos de agentes, histórico de decisões, documentação de ambientes, gates e handoff adicionados.
- **NÃO houve push para GitHub:** integração recusou escritas (403). **NÃO houve build/browser real:** npm inacessível (EAI_AGAIN).

Próximas mudanças devem registrar PR/SHA e resultados verificáveis.

## 2026-11-11 — Integração GitHub restabelecida

- Branch `setup/weblab-foundation` criada via conector autorizado; 55 arquivos de texto publicados no commit `dc0a7219007d2528bd99e5eb11ede9e3688dc3bf`.
- PR #1 aberto como rascunho, sem merge ou deploy.
- O status antigo de 403 é histórico; compilação Vite e navegador ainda não foram testados.

## 2026-11-11 — CI GitHub concluída

- Run `43022020392` concluída com sucesso: npm install, verificação da estrutura, testes unitários e build de staging (inclui typecheck).
- Artefato de build arquivado; chunk JS principal ~7,2 MB (não otimizado para download mobile).
- Navegador e Android seguem sem validação real.

## 2026-11-11 — Publicação e auditoria remota (corrige o histórico acima)

- Incidente GitHub 403 corrigido; branch `setup/weblab-foundation` e PR #1 em rascunho criados, `main` preservada.
- A CI remota da HEAD `a4201daeb50399830a318a2428076072ad44f8e0` passou (run 43022470633): instalação, validação documental, 6 testes e build de staging com typecheck.
- Revisada a próxima tarefa do Fable para trabalhar na branch e PR existentes; fonte de verdade, riscos, estado e direção visual corrigidos.
- Não houve testes reais em navegador/Android, captura de gameplay, lockfile nem deploy.
