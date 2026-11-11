# Qualidade: gates obrigatórios por etapa

## Gate A — Estrutura (starter)
- [ ] Arquivos e fontes de verdade presentes (`npm run validate:repo`)
- [ ] Testes determinísticos (`npm run test:unit`)
- [ ] Dependências instaladas com sucesso, sem erros
- [ ] `package-lock.json` gerado e versionado; CI alterado para `npm ci`
- [ ] TypeScript estrito (`npm run typecheck`)
- [ ] `npm run build:staging` funcional

## Gate B — Jogabilidade 0.1
- [ ] Render real no Chrome desktop e captura de tela **não IA**
- [ ] Moto acelera, freia, vira e para sem atravessar casa/limite
- [ ] Parado: descer, caminhar, retornar e montar; input não controla ambos
- [ ] Giro e zoom da câmera funcionam sem travamento
- [ ] Controles Android touch testados na orientação horizontal
- [ ] FPS mensurado num celular; modelo, navegador e resolução registrados
- [ ] Fica explícito na tela que mapa ainda NÃO é Brejo Alegre real
- [ ] Falhas e bloqueios documentados, sem passar como aceitos

## Gate C — Qualidade visual inicial
- [ ] Ruas, casas brasileiras, calçadas, muros e árvores com assets reais e licenças rastreadas
- [ ] Moto com aparência plausível sem sacrificar jogabilidade
- [ ] Perfil mobile visualmente mais leve que desktop
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
