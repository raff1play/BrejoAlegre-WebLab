# Estado factual — Brejo Alegre Web Lab

**Atualização:** 11/11/2026, após auditoria de documentos. Este é um registro datado, não substitui consulta à HEAD atual do GitHub.

## Repositório, branch e revisão

- Repositório público: https://github.com/raff1play/BrejoAlegre-WebLab
- `main`: commit inicial `2c55f700b7b9e195068a354699607d15381a245d` na inspeção; não houve merge do protótipo.
- Branch de preparação: `setup/weblab-foundation`, com a estrutura de 55 arquivos iniciais versionados.
- PR de revisão: https://github.com/raff1play/BrejoAlegre-WebLab/pull/1 — rascunho, ainda sem merge ou publicação.
- O incidente 403 do conector GitHub foi **resolvido**; branch e arquivos foram criados remotamente.
- Documentação revisada após os testes de CI; **consulte a HEAD e seu workflow vigente**, sem atribuir automaticamente o resultado de um commit anterior a um novo commit.

## Evidências de automação verificadas

| Evidência | Situação |
|---|---|
| CI da HEAD `a4201daeb50399830a318a2428076072ad44f8e0` | **SUCCESS** em https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43022470633 |
| Instalação de pacotes no runner CI | Executada com sucesso no workflow citado |
| `npm run validate:repo` | Aprovado nessa CI |
| `npm run test:unit` | 6/6 aprovados nessa CI |
| `npm run build:staging` | Aprovado nessa CI; inclui `tsc --noEmit` e Vite build |
| Testes locais preparatórios | 6/6 testes unitários; ver histórico de preparação. Instalação npm local bloqueada por EAI_AGAIN |
| `package-lock.json` | **AUSENTE** no starter; gerar, versionar e substituir `npm install` por `npm ci` em CI/Pages |
| Artefato do build CI | Houve artefato de staging em CI; isso **não equivale a deploy** |
| Render e interação no Chrome real | **NÃO TESTADOS** |
| Touch e FPS no Galaxy S24 | **NÃO TESTADOS** |
| Desempenho 30/60 FPS | **METAS**, não resultados |
| Página publicada no GitHub Pages | **NÃO PUBLICADA** |

A primeira CI verificada foi https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43022020392, também aprovada. O bundle principal reportado nessa execução era de ~7,2 MB pré-gzip (~1,6 MB gzip). Trata-se de tamanho JS de build, **não medição de FPS ou desempenho em aparelho**.

## Código que existe

- `src/main.ts`: composição da cena e loop.
- `src/world/temporaryWorld.ts`: rua, casas e loja fictícias, geometria em primitivas; colisores aproximados.
- `src/features/driving/motorcycle.ts`: moto simplificada e movimento cinemático, **não física real**.
- `src/features/walking/pedestrian.ts`: personagem primitivo e locomoção básica.
- `src/features/camera/`, `src/features/controls/`: câmera e entradas de teclado/touch escritas; execução ainda não validada no navegador.
- `src/core/collision.ts`, `tests/collision.test.ts`: guardas determinísticos de movimento e testes básicos.
- `docs/product/ORIGINAL_GODOT_SPEC.md`: visão futura, preservada sem alterar decisões D01–D17.
- `docs/product/WEBLAB_SCOPE.md` + `docs/DECISIONS.md`: exceções aprovadas para protótipo web.

## Arte e o que NÃO existe

- Não há modelos 3D premium prontos, mapa real de Brejo Alegre, servidor, multiplayer, scanner, economia nem operações logísticas na 0.1.
- As imagens/vídeos de IA criados em conversas anteriores **não estão na branch**; ver `docs/VISUAL_DIRECTION.md` para direção textual e limites.
- Nenhum APK, teste Android, FPS medido ou captura de gameplay foi produzido/comprovado.

## Próximo agente

Seguir `AGENTS.md` e `docs/NEXT_TASK_FOR_FABLE.md`. Confirmar branch/PR/CI atuais. Corrigir, testar no navegador, gerar lockfile, melhorar uma rua e documentação. Depois da tarefa, registrar SHA real, CI da nova HEAD, screenshots verdadeiros, status Android e bloqueios.

**Terminologia:** IMPLEMENTADO = código presente; TESTADO = comando ou ação reproduzida; NÃO TESTADO = sem execução; BLOQUEADO = tentou e falhou; APROVADO = usuário aceitou com evidência.
