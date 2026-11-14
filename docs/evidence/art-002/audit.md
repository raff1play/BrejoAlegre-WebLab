# Auditoria ART-002

Base: ART-001 `3931aa2`, mesma branch. Inspecionados AGENTS, documentos obrigatórios, cityPlan/cityBuild/depotDetail/cityLayout, workday/parcels/deliveryGame, guards, câmera, NpcPerson e testes de jornada.

- Terreno: 63,6 × 57,8 m, quadra q3. Os quatro cantos transformados com depotWorld estão dentro do polígono da quadra; sem mudar transformação, ruas ou lotes. O edifício mantém 44 × 24 m. Acesso continua na via existente. Referência geográfica é OSM; instalação fictícia.
- Fluxo anterior: `Workday.update` consumia minutos e avançava estados sem rota ou representação dos IDs. `move` sequer atualizava holder; histórico registrava `by` separado de uma custódia potencialmente antiga.
- Cena anterior: caixas fixas na esteira, pallets e gaiolas não correspondiam a encomendas; NPCs alternavam pontos por tempo, não por tarefas. Não serão reutilizadas como encomendas operacionais.
- Colisão anterior: paredes/móveis do depotLayout e geometria visual divergiam (guarita, plataformas das docas, colunas e objetos auxiliares). As cinco docas tinham plataforma elevada e fluxo misturado.
- Solução: equipamentos retangulares com altura/tipo e identidade numa única planta; portões deslizantes com a mesma geometria na colisão dinâmica; doca 05 para entrada de caminhão, 02 para retirada da rota mista, 01 para acesso a pé; outras reservadas. Descarga dos entregadores por vagas no pátio oeste, recebimento pela porta oeste. Corredores contínuos e rotas determinísticas testadas para funcionários.
- Pacotes: ampliar o sistema existente, sem inventário paralelo. Estado operacional separado de posição, custodiante, carga/doca e histórico. Tarefas devem mover o mesmo registro e a mesma representação visual antes de confirmar a transição.
