# LOG-004 — Prazos, equipe reforçada e calendário operacional

Alteração incremental da LOG-003 na branch experimental `feat/art-001-primeira-loja-moto`. Nenhum merge para `main`/`preview`, nem publicação por este pacote.

## Regras implementadas

- Três motociclistas NPCs iniciam o deslocamento às 11h e esperam o início da coleta às 12h. Velocidade de cruzeiro cinemática ajustada de 8 para 9,4 m/s; deslocamento a pé de 1,65 para 2,05 m/s, sem modificar a moto controlada pelo jogador. As pequenas pausas de coleta/estacionamento foram reduzidas.
- Retorno padrão previsto às **14h**; tolerância máxima operacional até **14h20**. O instante de chegada real é registrado em `Courier.returnedAt`. Se o relógio exceder 14h20, o jogo registra um alerta, **não teletransporta** o motociclista ou inventa uma entrega.
- Adicionados três funcionários distintos ao galpão: `conferente-2`, `separador-3`, `expedidor-2`; todos participam da mesma máquina de tarefas físicas. A base mantém o time anterior. A posição do terceiro separador foi corrigida após CI detectar colisão com a esteira.
- Os três motociclistas, após descarregar, trabalham no controlador `DepotOperations` como `auxiliar-npc1/2/3`. Auxiliares ajudam a alimentar a esteira, separar e encaminhar volumes, mantendo **os mesmos IDs, estados, posições e custódia**. Cada motociclista termina a tarefa atual antes de retirar sua própria saca; não é criado um segundo NPC visual.
- O fluxo interno foi otimizado com esteira processando cada volume em 13 s simulados (antes 16 s) e deslocamento dos funcionários em 2,05 m/s (antes 1,85). Não há salto de estado por hora.
- A retirada continua autorizada a partir das **15h**, quando a carga do setor estiver pronta; a equipe só é liberada conjuntamente quando todos estiverem prontos. Meta de quatro cargas separadas: **até 15h** nos dias comuns, **até 16h** nas segundas e terças.

## Calendário

Calendário fictício determinístico, primeiro dia **segunda-feira, 16/11/2026**. Ao concluir/encerrar uma jornada, o botão **Próximo dia útil** no menu de Logística avança a data e guarda o índice no `localStorage` do navegador; domingo é pulado. Não depende de uma API externa nem cria conta.

| Dia | Classificação | Pacotes/loja | Pacotes na van | Total possível | Meta da base |
|---|---|---:|---:|---:|---|
| Segunda | Alta | 4–5 | 12–15 | 44–55 | 16h |
| Terça | Alta | 4–5 | 12–15 | 44–55 | 16h |
| Quarta | Normal (padrão provisório) | 3–4 | 8–11 | 32–43 | 15h |
| Quinta | Média | 3–4 | 8–11 | 32–43 | 15h |
| Sexta | Média | 3–4 | 8–11 | 32–43 | 15h |
| Sábado | Fraca | 2–3 | 5–7 | 21–31 | 15h |
| Domingo | Folga (padrão provisório) | – | – | 0 | – |

Quarta e domingo não haviam sido especificados pelo usuário: as decisões acima são **defaults alteráveis**, não fatos obrigatórios. O sorteio ocorre no início de cada dia, não a cada frame, e a seed é derivada do índice de calendário para manter cenários reproduzíveis.

O modo desenvolvimento com `?seed=2026`, sem `?dia=N`, preserva a demanda clássica LOG-003 para seus testes de regressão. `?dia=N` em dev testa os dias sazonais.

## Evidências automatizadas e limites

A validação reproduz as coletas e o inventário físico da simulação, mas reposiciona o **jogador** entre os pontos de coleta e de descarga; não mede uma viagem manual real. NPCs executam caminhos normais. Tráfego ambiente desligado.

| Cenário máximo | Retorno dos três NPCs | Último volume separado | Meta |
|---|---|---|---|
| Segunda, 55 pacotes | 13h09–13h11 | ~15h47 | 16h |
| Quinta, 43 pacotes | 12h53–12h56 | ~14h58 | 15h |
| Sábado, 31 pacotes | 12h53–12h56 | ~14h28 | 15h |

Esses horários foram produzidos por `tests/log004-calendar.test.ts`, com asserts de retorno até 14h20, custódia única e prazos de separação. O teste também verifica calendário, faixas de demanda, ausência de domingo e seeds determinísticas.

**Limitações pendentes:** não foi executado o ciclo completo com tráfego ambiente ativo, nem ensaio do Galaxy S24, FPS/termal ou teste manual dos novos controles. A margem de quinta-feira é pequena e pode ser ultrapassada com congestionamento; o jogo registra atraso, não mascara. Calendário armazena progresso apenas no navegador local, sem sincronização online. A próxima etapa recomendada é homologar `/log-preview/` somente após autorização explícita para atualizar o commit publicado.
