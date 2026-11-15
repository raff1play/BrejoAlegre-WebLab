# Próxima tarefa planejada: HUD-001

**Ponto de partida obrigatório:** branch atual `preview`, com baseline LOG-006. Não retomar W009, Easter egg W010–W012, experimentos CORE-015.1 isolados ou PWA.

**Objetivo:** reorganizar HUD para Android paisagem em três modos: pilotando (objetivo, distância, hora, velocidade, mapa), a pé/loja (ação, mãos/baú), base (conferência, pacotes, prazo), preservando a tela central livre.

**Preservar:** direção analógica e sensibilidade atual, física, roteamento, telas de pausa e Logística, calendário, as quatro cargas, IDs e custódia, a resolução no celular. CSS responsivo, safe areas, botões com áreas de toque adequadas. Não alterar lógica por motivo visual.

**Antes de implementar:** reproduzir bug da moto roxa com trânsito e terminar gates de navegador. Registrar antes/depois com a mesma viewport e sem vender capturas de emulador como Android físico.

**Aceitação proposta:** o objetivo imediato legível, nenhum controle essencial sobreposto no Galaxy S24 paisagem, minimapa navega sem tapar trânsito, textos de coletados/entregues distinguem jogador versus equipe, interação a pé e base acessível, CI/E2E sem regressão.
