# 00 — Início obrigatório para qualquer colaborador ou LLM

## O projeto em 90 segundos

- Nome: **Brejo Alegre Web Lab**. Protótipo experimental 3D single-player para desktop/mobile via navegador, **não produto final**.
- Objetivo atual: **validar se dirigir, andar e observar uma rua brasileira 3D é interessante e viável**, sem servidor, login, multiplayer ou economia.
- Motor atual: Babylon.js + TypeScript + Vite. Motor previsto para futuro produto final: Godot, com **reimplementação do código** após validar a ideia.
- Território: futuro mapa pretende ter fidelidade verificável a Brejo Alegre/SP. **A área da primeira cena é fictícia**, com aviso na tela.
- Referências visuais produzidas por IA são **arte conceitual**, não execução do motor.
- Meta gráfica: estilo brasileiro semirrealista otimizado; meta 30 FPS a medir, sem garantia.
- Contrato completo de mecânicas, mapas, economia, custos, multiplayer e jornadas em `product/ORIGINAL_GODOT_SPEC.md`. O laboratório tem exceções técnicas aprovadas em `product/WEBLAB_SCOPE.md`.

## Leia nesta ordem

1. `../AGENTS.md`: restrições de segurança, engenharia e processo.
2. `PROJECT_STATE.md`: **o que existe e o que NÃO existe**.
3. `product/WEBLAB_SCOPE.md`: alterações de plataforma aprovadas para o laboratório.
4. `product/ORIGINAL_GODOT_SPEC.md`: decisões 01–17 do produto futuro.
5. `DECISIONS.md`: decisões web W001–W005, abertas e fechadas.
6. `ARCHITECTURE.md`, `ENVIRONMENTS.md`, `WORKFLOW.md`, `QUALITY_GATES.md`.
7. `NEXT_TASK_FOR_FABLE.md`: escopo da próxima implementação.
8. `GITHUB_UPLOAD_BLOCKER.md`: histórico do 403 resolvido; não presumir bloqueio atual.
9. `AGENT_HANDOFF.md`: resumo curto verificável para iniciar em outra LLM.

## Como atualizar este contexto

- Mudou uma regra aprovada? Criar entrada na tabela de `DECISIONS.md` com pedido explícito e arquivos afetados. Não ajustar a especificação historicamente sem registrar a alteração.
- Implementou algo? Anotar commit/PR, arquivos e testes **realmente feitos** em `PROJECT_STATE.md`.
- Encontrou erro ou dívida técnica? Registrar no `ISSUES_AND_RISKS.md`.
- Mudou fluxo, ambiente ou stack? Criar ADR em `adr/` com contexto, opções e impacto.
- Nada comprovado deve virar status “concluído”.

## Limites absolutos desta fase

Não inferir nenhuma mecânica a partir dos trailers e imagens; não construir o jogo inteiro; não tocar em outros repositórios, serviços ou apps. Só programar 0.1 até verificação de funcionamento.
