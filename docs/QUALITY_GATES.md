# Qualidade: gates obrigatórios por etapa

## Gate A — Estrutura (starter)

Marcação atualizada em 11/11/2026 para a versão 0.1 (commits `c0795b9`, `37a7d31`, `f1615d9`). Evidências em `docs/PROJECT_STATE.md` e `docs/evidence/`.

- [x] Arquivos e fontes de verdade presentes (`npm run validate:repo`) — CI
- [x] Testes determinísticos (`npm run test:unit`) — 25/25
- [x] Dependências instaladas com sucesso no runner CI
- [x] `package-lock.json` gerado e versionado; CI alterado para `npm ci`
- [x] TypeScript estrito (`npm run typecheck`), executado pelo `build:staging` na CI
- [x] `npm run build:staging` funcional no runner CI

## Gate B — Jogabilidade 0.1
- [x] Render real em Chromium (headless, GPU por software) e capturas **não IA** em `docs/evidence/` — falta Chrome desktop com GPU real
- [x] Moto acelera, freia, vira e para sem atravessar casa/limite (navegador + unitário)
- [x] Parado: descer, caminhar, retornar e montar; input não controla ambos (navegador)
- [x] Giro e zoom da câmera funcionam sem travamento (navegador)
- [ ] Controles Android touch testados na orientação horizontal — **só emulação de toque em viewport 780×360; aparelho real NÃO TESTADO**
- [ ] FPS mensurado num celular; modelo, navegador e resolução registrados
- [x] Fica explícito na tela que mapa ainda NÃO é Brejo Alegre real (HUD + placas 3D)
- [x] Falhas e bloqueios documentados, sem passar como aceitos (`ISSUES_AND_RISKS.md`)

## Gate C — Qualidade visual inicial
- [ ] Ruas, casas brasileiras, calçadas, muros e árvores com assets reais e licenças rastreadas — **parcial**: tudo existe em geometria/texturas procedurais próprias (sem licença externa), mas não são modelos de arte
- [x] Moto com aparência plausível sem sacrificar jogabilidade (primitivas; avaliação do usuário pendente)
- [x] Perfil mobile mais leve que desktop (implementado; ganho real não medido)
- [ ] Captura real comparada às referências IA com critérios explícitos de luz, escala, texturas e composição
- [ ] Sem prometer qualidade fotográfica em 30 FPS sem medição real

## Gate D — Produção web (SOMENTE após aprovação)
- [ ] PR revisado, CI verde e merge aprovado em main
- [ ] Build produção testado localmente
- [ ] GitHub Pages configurado e workflow disparado manualmente
- [ ] URL final de fato responde, sem redirecionamentos quebrados
- [ ] Teste Chrome Android da versão publicada, não somente do desenvolvimento

## Classificação de resultados

- **IMPLEMENTADO:** código existente, sem alegar teste.
- **TESTADO:** passo e resultado reproduzíveis, com evidência.
- **BLOQUEADO:** operação tentada e motivo verificável.
- **NÃO TESTADO:** não foi executado; não extrapolar.
- **APROVADO:** só após gate e aceite do usuário.
