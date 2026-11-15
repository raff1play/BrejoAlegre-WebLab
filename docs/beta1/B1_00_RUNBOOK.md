# B1-00 — Manual de execucao, teste, publicacao e aprovacao

**Escopo:** engenharia de entrega, NAO implementa jogabilidade da Beta 1.0. Contrato de produto: docs/BETA_1_0_SPEC.md e docs/BETA_1_0_DECISIONS.md (B1-01 congelado, 17 decisoes e 26 testes de aceite).

## Separacao de ambientes

- main: baseline estavel; nao ha publicacao automatica nem merge autorizado por este B1-00.
- preview: branch integrada de testes e unica fonte do site GitHub Pages de demonstracao.
- chore/beta1-00-orquestracao: preparacao, via PR para preview.
- feat/beta1-01-carreiras, feat/beta1-02-casas etc: uma branch de gameplay isolada baseada na HEAD aprovada da preview.
- fix/beta1-XX-...: correcoes do mesmo modulo antes de liberacao do seguinte.
- docs/beta1/STATE.json: estado persistente versionado dos dez blocos (B1-00 e B1-01 a B1-09).
- docs/BETA_1_0_SPEC.md: contrato congelado, nao indica que o jogo ja foi implementado.

## Fluxo obrigatorio de cada modulo

1. O usuario autoriza executar o modulo. Apos aprovacao do anterior, registrar EM_DESENVOLVIMENTO na preview usando a maquina de estados, e commitar no GitHub. Nao iniciar um modulo PENDENTE.
2. Criar branch feat/beta1-XX-descricao a partir da preview mais recente. PR para preview. Nao modificar docs/beta1/STATE.json no PR de gameplay; decisao central e independente da implementacao.
3. Rodar npm run check localmente; o PR executa o job verify (incluindo gate de ordem) e browser-smoke (Chromium com trafego). Conferir os resultados reais antes de qualquer merge; testes E2E nao sao teste Android fisico.
4. Quando o codigo estiver pronto, registrar EM_TESTES na preview e, depois dos checks aprovados e revisao, integrar o PR na preview. Sem mudanca na main.
5. O push de codigo na preview dispara o workflow Preview - Pages. O workflow executa novamente validacao, testes unitarios, build e browser E2E ANTES do deploy. A publicacao so e considerada concluida quando GitHub Actions informa success, com commit e URL verificados. Push apenas de documentacao/estado nao publica.
6. Depois de verificar o deploy, registrar AGUARDANDO_APROVACAO com URL de evidencia do GitHub e SHA da preview publicada. Comunicar ao usuario o link https://raff1play.github.io/BrejoAlegre-WebLab/ e os criterios do modulo.
7. O usuario avalia no navegador real e responde APROVO B1-XX ou REPROVO B1-XX com observacoes. Apenas uma aprovacao EXPLICITA registrada com nota e evidencia permite APROVADO. Reprovacao registra motivo e obriga corrigir o mesmo modulo, retestar e publicar outra demonstracao.
8. O proximo modulo permanece PENDENTE ate o anterior estar APROVADO. O gate de PR le o manifesto da BASE confiavel da preview, nao a versao arbitraria de um PR. Isso impede que uma branch de modulo se auto-aprove alterando o seu proprio manifesto.
9. Preservar SHA e notas da versao aceita. Para rollback, restaurar um commit especifico via PR/revert e republicar a preview passando pelos mesmos checks; nao tocar automaticamente na main.

## Comandos do estado local (commitar alteracoes manualmente)

Verificar sequencia e integridade:
  node scripts/beta1-control.mjs validate

Apos testes tecnicos, registrar a transicao do modulo:
  node scripts/beta1-control.mjs transition B1-00 EM_TESTES

Apos CI verde de B1-00 (B1-00 nao modifica gameplay nem exige deploy):
  node scripts/beta1-control.mjs transition B1-00 AGUARDANDO_APROVACAO --evidence https://github.com/raff1play/BrejoAlegre-WebLab/pull/NUMERO --sha SHA40

Somente se o usuario disser que aprova explicitamente:
  node scripts/beta1-control.mjs transition B1-00 APROVADO --note "APROVO B1-00: confirmacao explicita do usuario"

Reprovacao:
  node scripts/beta1-control.mjs transition B1-00 REPROVADO --note "Problema concreto observado na avaliacao"

Recomeco apos reprovacao:
  node scripts/beta1-control.mjs transition B1-00 EM_DESENVOLVIMENTO

Para B1-01+ usar o mesmo fluxo, com evidencia da execucao de PUBLICACAO APROVADA no GitHub Actions e SHA da preview publicada. Nao inventar sucesso, evidencias nem aprovacoes. A maquina de estados valida ordem e campos; o texto de uma aprovacao so pode vir de uma mensagem real do usuario.

## O que esta automatizado e o que nao esta

- Automatizado: testes de PR, validacao de sequencia dos modulos numerados, testes completos antes do deploy, publicacao da preview para alteracoes de jogo, auditoria do estado, rejeicao de avancos invalidos.
- Manual/assistido: desenvolver codigo, revisar e integrar PR, alterar/commitar o estado, obter aprovacao expressa, analisar falhas reais e reproduzir um problema no celular.
- NAO EXISTE executor remoto do Opus conectado ao GitHub Actions. Um workflow nao inicia outra sessao de programacao por si. Nenhuma promessa de implementacao em segundo plano.
- Branch protection/rulesets requerem configuracao administrativa no GitHub. Este B1-00 NAO possui essa permissao. Sem essa protecao, um administrador pode integrar PR com CI vermelho; a publicacao ainda possui verificacoes proprias que impedem deploy se falharem. Para bloqueio de merge, configurar em Settings > Rules > Rulesets (preview) os checks verify e browser-smoke, e restringir pushes diretos. Depois testar se a regra esta efetiva.
- GitHub Pages oferece um unico site. A workflow manual de main pode sobrescreve-lo; nao acionar pages.yml sem consentimento especifico.
- A saida de CI prova funcionamento automatizado em runner/Chromium, NAO desempenho ou ergonomia medidos no Galaxy S24 fisico.
- Nenhuma conta, assinatura, backend, app externo, secret nem dependencia de producao nova e necessaria.

## Teste de aceitacao do B1-00

- Manifesto B1-00 a B1-09 valido, na ordem, com apenas um modulo ativo, sem aprovacoes artificiais.
- Testes unitarios: rejeitar aprovacao fora da ordem, inicio do modulo seguinte, reprovacao sem motivo, e aprovacao sem evidencia.
- Simular transicoes EM_TESTES -> AGUARDANDO_APROVACAO -> APROVADO e REPROVADO -> EM_DESENVOLVIMENTO somente em memoria; NAO editar aprovacoes reais para passar no teste.
- PR B1-00 para preview passa verify e browser-smoke; nenhum jogo e publicado por merge de documentos apenas.
- Em futuros merges de jogo na preview, so publicar apos todos os gates no proprio workflow, guardando commit e URL.
- Estado inicial de B1-00 em EM_DESENVOLVIMENTO. Nao marcar APROVADO enquanto o usuario nao aprovar.

## Observacao sobre escopo congelado

B1-01 tem 17 decisoes confirmadas e 26 testes de aceitacao. Este B1-00 apenas integra os documentos e prepara o processo. Nunca reduzir os criterios B1-01 nem iniciar essa implementacao como efeito colateral da preparacao.
