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

**CONFIRMADO — Questionário 1 (4/4 respostas do usuário, 15/11/2026):**
1. **Personagens prontos e personalização básica:** quatro personagens predefinidos. O alcance exato da personalização básica (roupa, cabelo, gênero etc.) **não foi decidido**.
2. **Casa e setor fixos:** um personagem predefinido por setor, com sua casa própria fixa.
3. **Carreiras inativas sem progressão:** quando um perfil é jogado, os outros três personagens trabalham como NPCs **somente naquela simulação**; não recebem dinheiro nem experiência/progresso nos próprios saves por participarem como NPCs.
4. **Salvamento automático por checkpoints e opção de backup:** não foi definida ainda a frequência dos checkpoints, o comportamento exato de retomada, nem o formato e local do backup.

**CONFIRMADO anteriormente:** quatro carreiras independentes; um personagem sob controle por vez; começo possível com **moto antiga ou carro popular antigo próprio e quitado** (a escolha e a entrega técnica desse veículo ainda exigem alinhamento).

**Evidência da base existente:** `src/main.ts` em `preview` utiliza `localStorage` principalmente para manter `CALENDAR_STORAGE_KEY`; ainda não há uma persistência de quatro carreiras nem snapshot integral de entregas. Criar checkpoint não é apenas adicionar um botão “Salvar”.

**CONFIRMADO — Questionário 2 (4/4 respostas do usuário, 15/11/2026):**
5. **Personalização:** quatro personagens prontos, com **opções predefinidas de aparência masculina/feminina e equipamentos**. Não autoriza editor corporal/facial completo nem determina nomes, cores ou catálogo de equipamentos.
6. **Veículo inicial:** **uma moto antiga ou um carro popular antigo**, escolhido individualmente **por carreira**; ambos próprios e quitados conforme decisão anterior. **Ambos devem ser realmente jogáveis antes de aceitar B1-01**. Não basta exibir uma miniatura do carro no menu.
7. **Troca de carreira:** **somente depois de finalizar o expediente**. Não foi escolhido ainda o tratamento de abandono/encerramento antecipado de jornada travada, nem o efeito de fechar o navegador.
8. **Recuperação:** retomar a carreira **no último ponto seguro**, preservando **entregas concluídas e inventário**. A posição exata do ponto seguro, os gatilhos do checkpoint e como tratar o relógio/NPCs continuam por definir.

**Análise técnica fundamentada no código atual (`preview` em 15/11/2026):**
- `src/main.ts` instancia uma `Motorcycle` como veículo controlado; `src/features/city/vehicleModels.ts` contém modelo de carro de **trânsito NPC**, não uma classe de carro jogável. A decisão 6 exige mecânica nova de carro (controles, colisão, entrar/sair, câmera, estacionamento, interação básica de carga) e testes próprios. O detalhamento visual/físico avançado de carga continua no B1-05, mas não pode ser usado para disfarçar que o carro ainda não é dirigível.
- O salvamento da linha atual guarda principalmente o índice do calendário em `localStorage`; saves independentes + checkpoints consistentes precisam de estados de jornada, moto/carro, pacotes/custódia e proteção contra duplicação de pagamento.
- Proibir troca de carreira durante o expediente requer decidir o que fazer após travamento real, fechamento do navegador ou desejo de encerrar cedo; não flexibilizar unilateralmente a decisão 7.

**CONFIRMADO — Questionário 3 (4/4 respostas do usuário, 15/11/2026):**
9. **Carro com ciclo logístico completo e carga visual avançada ainda no B1-01:** não basta dirigir nem apenas simular carga; o carro escolhido pelo jogador deve fazer coleta, acondicionamento visual de encomendas, transporte, descarga na base, retirada de carga, entregas e registro de custódia do começo ao fim **antes do aceite do B1-01**. Isto amplia o B1-01 e cria dependência técnica do modelo de pacotes que seria aprofundado no B1-05; não reclassificar unilateralmente a decisão como recurso futuro.
10. **Veículo inicial fixo por carreira:** uma vez escolhido moto antiga ou carro popular antigo, permanece até implementação futura de garagem/progressão. **Sem troca gratuita** no B1-01.
11. **Não há encerramento antecipado:** o expediente **somente pode ser encerrado após concluir todas as entregas e procedimentos**. Isto substitui a antiga hipótese de encerramento antecipado. Ainda precisa esclarecer o que é “concluir” em caso de destinatário ausente, recusa, devolução, prazo 21h ou erro de navegação: a escolha confirmada não autorizou automaticamente considerar esses casos concluídos.
12. **Checkpoints:** salvar automaticamente **após operações importantes**, **ao pausar** e **quando tecnicamente possível ao sair do navegador**. Manter as decisões anteriores de backup e retomada no último ponto seguro, preservando entregas e inventário. Fechamento abrupto de aba/SO não garante evento de saída; checkpoint anterior deve estar gravado de maneira durável.

**Análise crítica e impacto de implementação (constatação/proposta, não nova decisão):**
- **Escopo ampliado:** o B1-01 deixa de ser apenas perfis/menu/save: inclui carro jogável com ciclo logístico completo e apresentação física da carga. Reutilizar infraestrutura comum de parcelas e custódia, se necessário, mas preservar o B1-05 como ampliação de **formatos, limite das mãos e acondicionamento avançado de moto/alforjes/suportes** e eventual refinamento do sistema compartilhado. Não usar o B1-05 para postergar a parte avançada do **carro** exigida no B1-01.
- **Risco de travamento permanente:** o código da `preview` contém limite `hour>=21` que interrompe atualização dos motoboys NPC em `src/core/delivery/couriers.ts`, limita retirada/entrega em `src/core/delivery/logisticsDay.ts` e pode marcar o expediente `ENCERRADA` com pendências. A nova regra 11 **entra em tensão** com isso; o agente não deve retirar limite de horário nem criar finalização automática sem decisão do usuário.
- **Ciclo visual do carro** requer testes de entrada/saída, dirigibilidade/colisão, capacidade/posicionamento de carga, coleta/descarga/entrega, transições de guarda e salvamento. Modelo de carro ambiente em `src/features/city/vehicleModels.ts` não satisfaz esta exigência.
- **Confiabilidade de checkpoints:** persistir ID do perfil, veículo, relógio, fase, localização segura, IDs/estados/posse/histórico dos pacotes e progresso; checkpoints atômicos, versionados, recuperáveis, sem pagamento duplicado. Salvar ao pausar e tentar salvar na saída sem depender dessa tentativa.

**BLOQUEADORES ESSENCIAIS ANTES DO CONGELAMENTO (ainda não decididos):**
A. **Definição de entrega/procedimento concluído:** todos os pacotes precisam ser entregues com sucesso, ou um resultado final válido (tentativa frustrada + devolução/conferência) também pode concluir o trabalho daquele pacote? Sem isso, ausência de morador pode tornar o expediente impossível.
B. **Regra do limite 21h e recuperação de bloqueio real:** depois de 21h pode finalizar procedimentos pendentes ou o trabalho obrigatoriamente precisa esperar o próximo dia? Qual saída segura quando uma rota/cliente fica inacessível, sem violar a proibição de encerrar antecipadamente?
C. **Escopo/qualidade mínimos da “carga visual avançada” do carro:** disposição visível no porta-malas/interior, física/limites por tamanho, carga manual ou arrumação assistida, e como isso conversa com o B1-05. A exigência de recursos avançados **já está confirmada**, porém os critérios visuais/funcionais específicos não.
D. **Política do salvamento e backup:** lista exata de pontos seguros, resultado ao restaurar uma jornada após falha, conflito com gravação antiga e como trocar a instalação do navegador sem perder a carreira (exportar/importar). O backup **já está confirmado**; o formato concreto não.

**Não decididos, mas não bloqueadores imediatos do modelo lógico:** nomes/visuais exatos dos quatro personagens, catálogo de equipamentos, modelo comercial exato de moto/carro e custos detalhados da progressão futura. Não assumir aprovação implícita. **Não iniciar implementação ainda.**

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
