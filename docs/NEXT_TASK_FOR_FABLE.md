# Tarefa atual — Implementar Web Lab 0.1 no navegador (Fable)

**ESTADO REAL ao escrever (11/11/2026):** O repositório `raff1play/BrejoAlegre-WebLab` já contém o starter. A branch `setup/weblab-foundation` e o PR #1 (rascunho para `main`) já existem. **Não recriar, não subir ZIP e não abrir outro PR sem necessidade.** A CI passou antes desta revisão documental; reconferir a HEAD após alterações. O código não tem teste de gameplay em navegador.

## Primeiro, obter o contexto sem memória de chat

Ler `AGENTS.md`, `docs/00_START_HERE.md`, `docs/PROJECT_STATE.md`, `docs/DECISIONS.md`, `docs/product/WEBLAB_SCOPE.md`, `docs/product/ORIGINAL_GODOT_SPEC.md`, `docs/QUALITY_GATES.md` e `docs/VISUAL_DIRECTION.md`. Se documento e repositório divergirem sobre progresso, verificar código/CI e atualizar estado com evidência.

## Objetivo único

Entregar **uma pequena cena 3D real funcionando no Chrome desktop e preparada para Android horizontal**: rua TEMPORÁRIA, moto cargo controlável, personagem a pé, câmera isométrica/oblíqua rotativa com zoom, colisões e controles touch. Não entregar somente plano, captura de IA ou vídeo promocional.

## Modo de execução e checkpoints

1. Trabalhar na branch **existente** `setup/weblab-foundation`, atualizando o PR #1; **não tocar em `main` e não fazer merge**. Conferir `git status`, branch e arquivos antes de editar.
2. Instalar dependências, gerar e versionar `package-lock.json`; substituir `npm install` por `npm ci` nos dois workflows, validando a mudança.
3. Rodar `npm run validate:repo`, `npm run test:unit`, `npm run typecheck`, `npm run build:staging`. Separar build verde de jogo testado.
4. **Abrir a aplicação no navegador real**, corrigir bugs de runtime. Demonstrar aceleração, freio, curva em movimento, parada, desmontar, caminhar e remontar; prevenir input simultâneo, teclas presas, atravessar paredes ou sair do mapa.
5. Confirmar follow/rotação/zoom e HUD FPS com base em leituras reais; testar resize e controles por ponteiro/touch. Registrar screenshots do browser, não de gerador de imagem.
6. Com a jogabilidade comprovada, melhorar UMA rua com ao menos cinco fachadas, calçadas, muros, portões, árvores/postes e moto cargo plausível, com licenças verificadas; otimização antes de decoração pesada. O mapa permanece fictício com aviso visível.
7. Registrar perfil gráfico mobile/desktop; medir bundle e FPS onde houver navegador/aparelho acessível. **Se não houver Galaxy/Android real disponível, declarar NÃO TESTADO** e fornecer checklist exato ao usuário, sem afirmar 30 FPS.
8. Atualizar `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md`, `docs/CHANGELOG.md`, e o manifesto de assets quando adicionar arquivo. Comitar incrementos no PR #1; não publicar Pages nem contratar serviços.

## Critérios de aceite

- Comandos de validação/typecheck/build/test concluídos com saídas reais e commit do lockfile.
- Página executa no navegador sem exceção bloqueante; captura e passos reproduzíveis.
- Moto, pedestre, câmera, colisão e controles funcionam; se algo falhar, registrar explicitamente.
- Cena é realmente 3D, renderizada pelo Babylon.js, **não** vídeo/imagem IA.
- A versão 0.1 pode ser aceita parcialmente se Android físico não foi testado, mas **não aprovar desempenho móvel** sem medição.

## Proibido antecipar

Backend, servidor, login, multiplayer, economia, pagamentos, scanner, coletas, 8 lojas operacionais, 50 destinos, cartografia definitiva, carro jogável, NPCs logísticos, Play Store; não modificar outros projetos. É proibido comprar assets, consumir serviços pagos, implantar no Pages, fazer merge ou alterar a especificação original sem autorização.

## Entrega final obrigatória

Resumo objetivo de arquivos/commits, PR #1, resultados exatos de cada comando, URL/captura de browser verdadeiro, status de teste Android/FPS, erros restantes, documentos atualizados e próximo passo verificável.

**Não pergunte novamente informações já documentadas.** Se achar lacuna sem impacto na 0.1, anote como pendência e prossiga; só peça autorização se uma escolha puder alterar uma decisão já aprovada.
