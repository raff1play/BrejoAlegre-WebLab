# Estado factual do projeto — atualizar em todo PR

**Última revisão:** 2026-11-11. **Fonte:** inspeção local da base gerada + consulta ao GitHub com o conector disponível.

## GitHub remoto (verificado em 11/11/2026)

- Conta conectada: `raff1play`; repositório público: `raff1play/BrejoAlegre-WebLab`.
- `main` não foi alterada; commit inicial observado: `2c55f700b7b9e195068a354699607d15381a245d`.
- **Erro 403 resolvido:** a integração GitHub permitiu criar a branch e enviar os arquivos.
- Branch de preparação: `setup/weblab-foundation`; commit base: `dc0a7219007d2528bd99e5eb11ede9e3688dc3bf`.
- **55 arquivos de texto versionados**, incluindo código, regras dos agentes, especificação e workflows de CI/Pages.
- PR em rascunho: https://github.com/raff1play/BrejoAlegre-WebLab/pull/1 — sem merge, sem deploy.
- Os três documentos `docs/archive/` e o JPG `docs/assets/visual_references_AI.jpg` ainda não estão nesta branch; são material opcional, não necessário para instalação inicial.

## Conteúdo da branch (não confundir código publicado com funcionalidade validada)

| Item | Estado | Evidência / limite |
|---|---|---|
| Arquivos de base Babylon/Vite/TypeScript | Versionados na branch | Código textual presente; não é comprovação de compilação |
| Subpastas por feature e config ambiente | Versionadas na branch | `src/features/`, `src/config/`, `src/core/` |
| Mundo temporário, moto, caminhar, HUD | Código fonte presente | `src/`; ainda sem ensaio real de gameplay |
| Colisão aproximada 2D com casas | Código e testes unitários | `npm run test:unit`: **6/6 passaram** em Node.js 22.16.0 local; não equivale a teste de física no navegador |
| Regras de agentes e fonte de verdade | Escritas | `AGENTS.md`, `CLAUDE.md`, `docs/` |
| Validação de documentação | TESTADA localmente | `node scripts/validate-repository.mjs`: 18 arquivos obrigatórios presentes |
| Transpilação de sintaxe TS | TESTADA localmente | `typescript.transpileModule`: 9 fontes TS sem erros sintáticos; não é typecheck completo |
| CI staging e Pages manual | Arquivos versionados na branch | CI remoto pode rodar automaticamente; resultados ainda precisam ser verificados; Pages não foi publicado |
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
