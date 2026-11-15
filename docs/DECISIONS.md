# Decisões vigentes — ponto de partida de 15/11/2026

Para decisões históricas, veja [arquivo integral da versão LOG-006](https://github.com/raff1play/BrejoAlegre-WebLab/blob/archive/2026-11-15-log006-published/docs/DECISIONS.md). A reescrita deste documento **não revoga** a especificação futura em `docs/product/ORIGINAL_GODOT_SPEC.md`.

1. **Plataforma:** continuar Web Lab 3D single-player no navegador, Babylon.js + TypeScript + Vite; Godot/multiplayer é projeto posterior separado. Sem novas assinaturas ou infraestrutura permanente.
2. **Operação:** 1 jogador e 3 motoboys NPC (Rosa, Caio, Davi), 8 lojas, até 4 setores/cargas e galpão físico; pacote tem um único ID, custódia auditável, nenhuma contagem duplicada.
3. **Relógio:** abre às 11h45, NPCs iniciam deslocamento às 11h47 do jogo (2 min virtuais = 5 segundos reais em escala normal), coletas às 12h; 1 hora virtual = 150 segundos reais. Jornada até 21h, conclusão antecipada permitida.
4. **Prazos:** NPCs devem buscar retorno até 14h, tolerância 14h20; triagem até 15h em dias normais e 16h em alta demanda; tarefas físicas continuam necessárias, sem teleporte de encomendas.
5. **Calendário:** alta demanda segunda/terça, média quinta/sexta, fraca sábado. Quarta normal e domingo folga são defaults provisórios e podem ser revistos.
6. **Equipes:** base ampliada com 3 trabalhadores; motoboys ajudam a triagem após descarga. Saída conjunta após todas as sacas estarem guardadas e após 15h.
7. **Controle:** manter moto responsiva no Android, analógico, botões de acelerar/frear, descer/montar, câmera e minimapa; PWA anterior permanece desativada.
8. **LOG-006:** tentativa de impedir bloqueio circular entre veículo e moto estacionada; comportamento só é considerado homologado após teste com trânsito ativo.
9. **Qualidade:** regressões são obrigatórias; para mudar a `main`, revisar PR. Publicar preview **apenas com autorização explícita**.
10. **HUD-001/CTRL-001/MAP-001:** implementados em PR para `preview` sem alterar física (`MOTO`), roteamento NPC ou custódia de pacotes. O analógico normaliza o polegar pela curva disponível em cada velocidade; o minimapa não mostra ETA nem instruções sem cruzamento real no grafo OSM. Aceite final depende do usuário e de teste no Galaxy S24.
