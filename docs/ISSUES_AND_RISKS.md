# Riscos abertos — baseline de 15/11/2026

| Prioridade | Questão | Fato / próximo teste |
|---|---|---|
| Alta | Motoboy roxo possivelmente bloqueado por vans | Usuário forneceu capturas 12h33 e 15h18 da versão anterior. LOG-006 remove espera circular no código; não existe confirmação end-to-end de jornada com tráfego intenso no Galaxy S24. |
| Alta | NPCs podem ultrapassar 14h20 | Retorno tardio gera alerta, não garantia rígida. Exercitar seeds, congestionamento e transições na base. |
| Alta | Fluxo acelerado de espera | Relógio pode acelerar mais que deslocamentos físicos de NPC; realizar auditoria de simulação e evitar salto de pacotes. |
| Alta | Provas de Android físico | FPS, consumo térmico, oclusão, toque e fluxo inteiro ainda dependem de dispositivo real. |
| Média | Testes E2E antigos | Roteiros pré-LOG-005/006 foram arquivados. Novo smoke verifica baseline atual; ainda requer teste de jornada completa e tráfego. |
| Média | Interface HUD | Muitos chips concorrem por área útil na paisagem; próxima iniciativa HUD-001 sem mexer na física. |
| Média | Metas de triagem com pouca margem | Mesmo com testes 55/43/31, cenários com trânsito e interações normais não têm aprovação. |
| Média | Telemetria em produção | Controles de teste não devem vazar; `__weblab.snapshot()` expõe apenas dados diagnósticos públicos sem alterar jogo. |
| Baixa | Quarta/domingo | Padrões de calendário provisórios. |
| Baixa | Página de testes única | Deploy de produção/main manual sobrescreveria o Pages existente se disparado. |
| Baixa | Arquivo histórico grande | Preservado na branch de archive; remover arquivos da árvore atual **não reduz por si só** o tamanho do histórico Git. |

Não declarar falhas solucionadas apenas por passar testes isolados. Adicionar nova entrada ao surgir bug com reprodução observável.
