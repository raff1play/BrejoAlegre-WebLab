# Estado atual auditável — Brejo Alegre Web Lab

## Atualização operacional — Beta 1.0 (15/11/2026)

**Linha atual de integração:** `preview`. Os PRs #8 (HUD-001/CTRL-001/MAP-001) e #9 (CTRL-002) já foram integrados, embora a seção histórica abaixo ainda os descreva como "em revisão". **Não implementar novamente.**

**B1-00:** aprovado explicitamente pelo usuário e registrado em [STATE.json](beta1/STATE.json); infraestrutura integrada pelos PRs #10 e #11, com testes de PR e teste de publicação na `preview` confirmados. O GitHub Pages continua com o mesmo jogo, sem funcionalidades Beta 1.0 acrescentadas. `main` não foi alterada.

**B1-01:** 17 decisões e 26 testes de aceitação congelados em [BETA_1_0_SPEC.md](BETA_1_0_SPEC.md); permanece `PENDENTE` para implementação no manifesto. [Contratos técnicos B1-01](beta1/B1_01_CONTRATOS_INTEGRACAO.md) alinham carreiras, moto/carro, pacotes, base, madrugada, retomada e fronteiras dos módulos posteriores. Esse alinhamento é **documental**, não comprova código nem publicação do B1-01.

**Controle de atualização:** para status de aprovação, o manifesto `docs/beta1/STATE.json` é a fonte operacional; descrições LOG-006 e "em revisão" abaixo são registros históricos da baseline original. O agente deve consultar HEAD atual de `preview` antes de qualquer implementação.


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

## Em revisão (branch `feat/hud-001-mobile-controls`, PR para `preview`)

- **HUD-001:** HUD por contexto (pilotando / a pé / na base), progresso meu × equipe separado, avisos fora do centro, CSS consolidado, rótulo de experimento removido, relógio HTML 11h45.
- **CTRL-001:** analógico flutuante (centro no primeiro toque, acompanhamento limitado), eixo X axial para a moto e curva normalizada pela guinada disponível na velocidade; física `MOTO` inalterada.
- **MAP-001:** minimapa com direção da moto para cima, zoom por velocidade, rota de alto contraste, próxima conversão apenas em cruzamentos reais, recálculo ao sair da rota; mapa ampliado com setores e paradas numeradas. Sem ETA.
- Evidências: [`docs/evidence/hud-001`](evidence/hud-001/README.md). Não validado em Android físico.

## Prioridade futura

1. Revisar testes E2E com navegador e tráfego ativo.
2. HUD-001/CTRL-001/MAP-001 — implementados em PR; falta aceite do usuário e calibração no Galaxy S24.
3. Só depois planejar recursos novos com critérios de aceitação.

**O que não existe:** multiplayer real, backend, economia persistente, garagem/financiamento CORE-016, scanner virtual completo ou lançamento do jogo Godot. A versão web é o protótipo.
