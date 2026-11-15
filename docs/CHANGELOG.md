# Changelog — linha de continuidade

Histórico anterior a 15/11/2026 arquivado no [snapshot LOG-006](https://github.com/raff1play/BrejoAlegre-WebLab/blob/archive/2026-11-15-log006-published/docs/CHANGELOG.md).

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
