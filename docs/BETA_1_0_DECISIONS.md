# Beta 1.0 — Registro de decisões e alinhamento por módulos

**Status:** planejamento; nenhum módulo Beta 1.0 implementado por este documento.
**Branch de especificação:** `docs/beta-1-0-blueprint`.
**Documentação funcional:** [BETA_1_0_SPEC.md](BETA_1_0_SPEC.md).
**Atualização:** 15/11/2026.
**Objetivo:** debater *um módulo por vez*, distinguindo decisões confirmadas, recomendações e escolhas pendentes. Não presumir que uma recomendação foi aprovada.

## Preparação B1-00 (fora dos nove módulos)

**Pendente de implementação:** integrar especificação à linha `preview`, preparar CI/E2E, controle de estado/APROVO/REPROVO, branch por bloco, publicação de demonstração e recuperação de versão. O GitHub Actions atual testa e pode publicar sob gatilho autorizado, **mas não tem um agente de programação autônomo conectado à sequência**. Não prometer execução contínua sem confirmar um executor capaz de iniciar novas tarefas.

## Decisões já confirmadas em conversa

- Direção: paródia brasileira de entregas, arcade/divertida; realismo seletivo.
- Quatro carreiras independentes, não um único progresso compartilhado.
- Quatro personagens, cada um com casa funcional, veículo, setor e coletas; outros três participam como NPCs na carreira ativa.
- Jogador começa a jornada às **11h30 em casa**, pega equipamentos, visita lojas, base, entrega e volta para casa; NPCs também voltam para suas casas.
- CORE-016 anterior: **opção de começar com moto antiga ou carro popular antigo, próprio e quitado**. Não remover a escolha por padrão.
- Doze lojas em cerca de três por setor, distribuição por proximidade e equilíbrio operacional.
- Pacotes variados; até seis volumes nas mãos, desde que tamanho e peso permitam; baú, alforjes e suporte externo com organização física.
- Base: três NPC motoboys auxiliam triagem após descarga; chegada ideal 14h, tolerância 14h20, separação normal até 15h, alta demanda até 16h.
- Entregas: interação no portão, campainha, moradores, opção de vizinho/local permitido, arremesso arriscado, falha de entrega; pacotes não somem da simulação.
- Áudio, animações e humor brasileiro para dar identidade às ações.
- Corredor de motos: passar entre carros quando há **espaço físico**; sem atravessar colisores ou ficar em bloqueio permanente.
- Dias de demanda: segunda/terça alta, quinta/sexta média, sábado baixa; quarta/domingo continuam provisórios.
- Cada módulo exige uma versão jogável avaliada pelo usuário antes do próximo.

## Novo índice oficial e decisões a investigar

### B1-01 — Personagens e carreiras
**Fazer:** menu de quatro perfis, identidade visual, progresso, economia e saves separados.
**Já confirmado:** quatro carreiras independentes, um personagem ativo; moto ou carro popular antigo quitado como escolha de início.
**Pendente:** avatar predefinido/customizável, residências e setores fixos/selecionáveis, troca entre perfis durante jornada, efeitos dos NPCs nos outros três saves, checkpoints/backup. **Primeiro questionário:** avatar, região, progresso de perfis inativos, salvamento.

### B1-02 — Casas e começo do dia
**Fazer:** quatro casas pequenas com quarto/cabide/garagem/portão; equipamento, moto e início 11h30.
**Pendente:** o que é obrigatório todos os dias vs atalho de animação, interiores abertos/fechados, tempo de preparação, como carros iniciam ao lado de casas sem garagem grande.

### B1-03 — Lojas e distribuição de coletas
**Fazer:** doze lojas acessíveis, em média três por setor, demanda e trajetos por malha viária.
**Pendente:** permitir exceções de setor por demanda, limite de volumes em cada loja, coleta obrigatória nas três lojas ou variável por dia, impacto do tipo de veículo.

### B1-04 — Trânsito e corredor de motos
**Fazer:** o jogador e motoboys NPCs ultrapassam filas entre carros, quando há espaço, com colisões e cruzamentos coerentes.
**Pendente:** tolerância arcade de largura, ritmo de ultrapassagem, quanto o NPC espera antes de procurar desvio, preferência de velocidade para carregamento externo, motos do tráfego ambiente.

### B1-05 — Pacotes e capacidade da moto
**Fazer:** envelopes/caixas de vários tamanhos, até seis nas mãos condicionados ao porte, slots em baú/alforjes/suportes, pacote persistentemente identificado.
**Pendente:** carregar automaticamente vs manualmente, como lidar com volume excedente, compras de equipamentos, até onde simular encaixe e peso sem microgerenciamento.

### B1-06 — Base e separação de encomendas
**Fazer:** chegada, descarga, fila, triagem, sacas por setor, postos de trabalho e ajuda dos motoboys; ninguém sobreposto.
**Pendente:** quanto jogador participa na triagem, visualização da fila e tempo restante, possibilidade de ajudar e bônus, contingência quando demanda alta atrasa.

### B1-07 — Entregas e escolhas do jogador
**Fazer:** estacionar, buscar pacote, campainha, morador, vizinho, deixar em local permitido, arriscar arremesso, registrar tentativa e status real.
**Pendente:** quando vizinho ou porta/caixa podem receber, validação/foto/comprovante, danos, rapidez dos diálogos, consequências econômicas e penalidades moderadas.

### B1-08 — Sons, animações e humor
**Fazer:** animações procedurais curtas e sons de moto, baú, passos, portas, campainhas, moradores, reações e eventos engraçados.
**Pendente:** falas gravadas vs balões com sons, frequência de eventos especiais, configuração de volume e legendas, pacote inicial de recursos e licenciamento.

### B1-09 — Fim de expediente e próximo dia
**Fazer:** motorista e três NPCs terminam e voltam às respectivas casas; saldo do dia, ocorrências, atualização do calendário e save.
**Pendente:** se o retorno pode ultrapassar 21h, destino de entregas não concluídas, dias de folga, periodicidade da remuneração, custos de combustível/manutenção, progressão de veículos sem implementar financiamento profundo já na Beta.

## De/para da renumeração (somente documentação antiga, sem códigos implementados)

| Código anterior | Código novo |
|---|---|
| B1-01 | B1-01 |
| B1-02 | B1-02 |
| B1-03 | B1-03 |
| B1-09 (corredor) | **B1-04** |
| B1-04 (pacotes) | **B1-05** |
| B1-05 (base) | **B1-06** |
| B1-06 (entregas) | **B1-07** |
| B1-07 (sons/animações) | **B1-08** |
| B1-08 (fim de dia) | **B1-09** |

## Método de decisão

Apresentar somente 3–5 questões de múltipla escolha por módulo, com recomendação contextualizada e possibilidade de resposta parcial. Registar escolhas **somente após resposta do usuário**. Se resposta contrariar decisão anterior, explicitar o conflito e pedir confirmação antes de redefinir uma regra já congelada. Depois do aceite do módulo conceitual, atualizar o documento, seus critérios de testes e o contrato da branch de implementação. Não iniciar código ou publicação por inferência.
