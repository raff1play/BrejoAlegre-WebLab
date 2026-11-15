# Estado atual auditável — Brejo Alegre Web Lab

**Data de consolidação:** 15/11/2026. **Versão pública de partida:** LOG-006, commit Git `f98b652d32dece186ecfa654af7e7688f08254e6`. A antiga árvore completa e as evidências estão preservadas na branch `archive/2026-11-15-log006-published`. Este documento resume somente o estado relevante para próximas mudanças.

## Implementado na árvore-base

- Vite 7.3 + TypeScript 5.9 + Babylon.js 9.35, single-player web, dois perfis gráficos, 3D e controles touch/paisagem; sem servidor, login, conta, multiplayer ou pagamentos.
- Rede viária de Brejo Alegre/SP derivada de OSM, ruas, quadras e lotes estimados, trânsito e pedestres NPC, lojas e base fictícias.
- Oito lojas, um entregador jogador e três motociclistas NPC; quatro setores com sacas ML/Shopee misturadas e docas dedicadas; van de abastecimento assistida. Encomendas preservam ID, localização, custódia e histórico sem duplicidade.
- Moto e personagem com montar/desmontar, coleta/descarga física, triagem de base com dez trabalhadores, NPCs passando a auxiliar a separação após descarga e saída conjunta para entregas.
- Relógio: jornada começa **11h45**; três NPCs saem após 2 minutos virtuais, às **11h47**, coletas a partir de 12h. Hora virtual = 150 segundos reais em velocidade normal. Retorno ideal 14h, tolerância sinalizada depois de 14h20, sem teleporte garantidor. Separação visa 15h (16h em alta demanda).
- Calendário: segunda/terça alta, quinta/sexta média, sábado fraca; quarta normal e domingo folga **padrões provisórios**. A data avança por dias úteis no navegador.
- LOG-006: veículos de rua devem poder passar quando motoboy está coletando/cedendo; os bloqueios do jogador não são ignorados. Correção foi aprovada por testes de simulação, **não por longa reprodução de tráfego Android**.

## Evidência verificada para a baseline

- GitHub Actions `43673529828`: 145 testes unitários aprovados, `validate:repo`, TypeScript e build staging aprovados, publicação GitHub Pages success no commit `f98b652`.
- Há testes de simulação de segunda 55, quinta 43 e sábado 31 pacotes; os testes reposicionam o jogador artificialmente entre tarefas e desligam tráfego ambiente. São testes de invariantes, não de uma sessão humana completa.
- Não houve teste físico de desempenho/FPS/temperatura no Galaxy S24 pela automação. Trânsito intenso prolongado, travamentos de rota e UI ainda dependem de homologação.

## Prioridade futura

1. Revisar testes E2E com navegador e tráfego ativo.
2. HUD-001 — compactar objetivos, mostrar informações contextuais, reorganizar minimapa e botões mantendo física/controles.
3. Só depois planejar recursos novos com critérios de aceitação.

**O que não existe:** multiplayer real, backend, economia persistente, garagem/financiamento CORE-016, scanner virtual completo ou lançamento do jogo Godot. A versão web é o protótipo.
