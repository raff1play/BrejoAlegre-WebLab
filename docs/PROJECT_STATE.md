# Estado factual do projeto — atualizar em todo PR

**Última revisão:** 2026-11-11. **Fonte:** inspeção local da base gerada + consulta ao GitHub com o conector disponível.

## GitHub remoto (verificado)

- Conta conectada `raff1play`; repositório: `raff1play/BrejoAlegre-WebLab`.
- Visibilidade: **público**; branch-padrão: `main`.
- Commit da `main` observado: `2c55f700b7b9e195068a354699607d15381a245d` (README inicial somente).
- Tentativas reais de criar `setup/weblab-foundation` e criar arquivo na branch pela integração: **ambas HTTP 403 — Resource not accessible by integration**.
- **Conclusão: os arquivos desta base NÃO foram enviados ao remoto e nenhum PR/deploy foi criado.** Será necessário reautorizar escrita no GitHub ou fazer push manual/por um agente autorizado.

## Preparação local (não confundir com repositório publicado)

| Item | Estado | Evidência / limite |
|---|---|---|
| Arquivos de base Babylon/Vite/TypeScript | Criados localmente | Código textual presente; não é comprovação de compilação |
| Subpastas por feature e config ambiente | Criadas localmente | `src/features/`, `src/config/`, `src/core/` |
| Mundo temporário, moto, caminhar, HUD | Código fonte presente | `src/`; ainda sem ensaio real de gameplay |
| Colisão aproximada 2D com casas | Código e testes unitários | `npm run test:unit`: **6/6 passaram** em Node.js 22.16.0 local; não equivale a teste de física no navegador |
| Regras de agentes e fonte de verdade | Escritas | `AGENTS.md`, `CLAUDE.md`, `docs/` |
| Validação de documentação | TESTADA localmente | `node scripts/validate-repository.mjs`: 18 arquivos obrigatórios presentes |
| Transpilação de sintaxe TS | TESTADA localmente | `typescript.transpileModule`: 9 fontes TS sem erros sintáticos; não é typecheck completo |
| CI staging e Pages manual | Arquivos escritos | Workflows NÃO enviados/habilitados no GitHub |
| npm install e compilação completa | **BLOQUEADOS** | npm registry indisponível (`EAI_AGAIN`) durante preparação |
| package-lock.json | **NÃO EXISTE** | Precisa ser gerado por npm install real, depois versionado |
| Testes Android/Chrome/FPS | **NÃO EXECUTADOS** | Sem evidências de dispositivo ou browser |
| Gameplay completo, mapa real, logística | **NÃO IMPLEMENTADOS** | Fora de 0.1 |

## Evidências que precisam constar após o Fable

- URL da branch e do PR, SHA do commit.
- Saída de `npm run validate:repo`, `npm run test:unit`, `npm run typecheck`, `npm run build:staging`.
- Captura **real** do navegador, identificação da versão e confirmação dos controles.
- Se teste Android: modelo, navegador, FPS medido, resolução, orientação, problemas touch e temperatura.
- Lista de itens não testados, falhas, riscos e aceites.

## NOTA PARA NOVAS IAs

O conteúdo deste documento é histórico e não verifica automaticamente estados futuros. Antes de agir, **reinspecione** branch, PR, CI e diretório. Se a execução mudar, atualize fatos aqui com data e evidência. Nunca substitua fatos por memória de chat.
