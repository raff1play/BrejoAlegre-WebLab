# Changelog — linha de continuidade

Histórico anterior a 15/11/2026 arquivado no [snapshot LOG-006](https://github.com/raff1play/BrejoAlegre-WebLab/blob/archive/2026-11-15-log006-published/docs/CHANGELOG.md).

## 15/11/2026 — HUD-001 + CTRL-001 + MAP-001 (PR para `preview`)

- HUD por contexto (pilotando, a pé, na base), progresso meu × equipe, avisos sob o objetivo, CSS consolidado, rótulo de experimento removido e relógio HTML 11h45.
- Analógico flutuante com acompanhamento limitado; direção da moto normalizada pela curva disponível em cada velocidade (física inalterada): 10 km/h com 25 % do polegar passa de 28 % para 53 % da curva possível; 40 km/h com 25 % cai de 75 % para 42 %.
- Minimapa com direção da moto para cima, zoom 55–115 m por velocidade, rota destacada, seta de conversão só em cruzamentos reais, recálculo ao sair da rota; ampliado com setores e paradas numeradas.
- 155 unitários; E2E com multitoque CDP, contextos e resoluções 915×412/780×360. Sem teste em Android físico.

## 15/11/2026 — ponto de partida LOG-006

- Versão publicada em Pages: `f98b652`; CI e deploy bem-sucedidos, 145 testes unitários na baseline; novo teste LOG-006 reproduz espera por van e retomada em simulação.
- LOG-005: partida às 11h45, NPCs saem às 11h47 (2 minutos virtuais); LOG-004 mantém calendário, prazos e triagem física.
- Pendente: comprovar tráfego prolongado, UI e desempenho Android em partida completa.

## 15/11/2026 — housekeeping / nova baseline

- Snapshot integral criado antes de remover quaisquer arquivos, na branch `archive/2026-11-15-log006-published`.
- Evidências, scripts e builds experimentais antigos retirados da árvore ativa; continuam no arquivo.
- Documentação reescrita com o estado atual, sem instruções conflitantes de W009/CORE-012.
- Tests E2E antigos, incompatíveis com o calendário/LOG-005, arquivados; novo teste de integração no navegador cobre a baseline atual. Testes unitários de pacotes, trânsito e geometria preservados.
- Deploy de limpeza não disparado automaticamente; preservar o Pages publicado até ordem explícita.
