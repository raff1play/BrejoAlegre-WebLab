# Contrato de próxima tarefa — Fable 0.1 (não apenas planejamento)

**Leia primeiro:** `AGENTS.md`, `docs/00_START_HERE.md`, `docs/PROJECT_STATE.md`, `docs/product/WEBLAB_SCOPE.md`, `docs/product/ORIGINAL_GODOT_SPEC.md`, `docs/QUALITY_GATES.md`.

## Resultado pedido

Entregar uma **cena 3D realmente controlável no navegador**, de rua brasileira TEMPORÁRIA, com moto, personagem, câmera, controles e colisão. Melhorar a direção de arte gradualmente, mas só depois de comprovar que o jogo executa.

## Passos em ordem e aceite

1. Conferir o GitHub remoto `raff1play/BrejoAlegre-WebLab` e permissões. Se não puder escrever, reportar bloqueio claro e manter artefatos locais; nunca tentar bypass de segredos ou editar `main` como atalho.
2. Subir a base existente por branch `feat/weblab-0.1` ou `setup/weblab-foundation`; evitar recriação de estrutura paralela. Se a branch foundation já existir, inspecionar antes de alterar.
3. `npm install --no-audit --no-fund`, gerar e versionar `package-lock.json`, trocar CI e Pages para `npm ci`, executar validação/documentação/testes/typecheck/build.
4. Abrir **de verdade** num navegador. Consertar erros de runtime, física/controles e colisões. Validar: acelerar/frear/esterçar; parar/desmontar; andar/montar; câmera/zoom; HUD; aviso de área fictícia.
5. Melhorar UMA rua com no mínimo cinco fachadas, muros/portões, calçadas, postes e árvores em 3D com assets licenciados quando possível; moto cargo com silhueta plausível. Referências IA são apenas direção de arte. Não prometer photorealismo.
6. Ajustar perfis mobile/desktop a partir de dados, testar touch no Android real se houver acesso. Registrar dispositivo, navegador, FPS real; quando indisponível marcar NÃO TESTADO.
7. Atualizar `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md`, `docs/CHANGELOG.md` e preparar PR **sem merge automático**. Não publicar Pages nem contratar serviço sem autorização.

## Fora do escopo

Logística de pacote, scanner, 8 lojas operacionais, 50 destinos, mapas definitivos, carro jogável, economia, NPCs, backend, autenticação, servidor, banco, multiplayer, Play Store. Não reescrever o contrato Godot para acomodar o laboratório.

## Formato do relatório

- Código criado ou modificado e compromisso (SHA)
- Resultado REAL de cada comando/teste, com saída resumida
- Evidência do navegador (captura real ou descrição de teste concreto)
- FPS e Android: testado ou NÃO TESTADO
- Problemas não resolvidos / bloqueios
- Link de PR se realmente criado
- Documentação de contexto atualizada para próxima IA

Não responda somente com plano: modifique arquivos e execute verificações acessíveis no ambiente atual. Não afirme que passou sem rodar.
