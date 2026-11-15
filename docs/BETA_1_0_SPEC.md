# Brejo Alegre Delivery Simulator — Beta 1.0
## A Vida de Entregador: especificação consolidada do jogo

**Status:** especificação de produto para implementação futura; NÃO implementado nem homologado.  
**Data:** 15/11/2026.  
**Base técnica:** Web Lab Babylon.js / TypeScript / Vite; atualizações HUD-001/CTRL-001/MAP-001 e CTRL-002 integradas à `preview`; `main` permanece como baseline separada.  
**Pré-requisito já publicado para teste:** HUD-001 + CTRL-001 + MAP-001 (PR #8) e calibração de direção CTRL-002 (PR #9) na `preview`; ergonomia e desempenho reais continuam sujeitos à avaliação do usuário. A Beta 1.0 não foi implementada.  
**Cuidado:** este documento não altera gameplay, não publica o site e não revoga o histórico da branch archive/2026-11-15-log006-published.

### Legenda de decisão
- **CONFIRMADO:** escolha explícita do usuário nesta conversa ou decisão já estabelecida no projeto.
- **PROPOSTO:** recomendação de design/engenharia que pode ser ajustada durante a implementação.
- **PENDENTE:** escolha que exige validação ou definição antes de congelar o comportamento.

---

## 0. Visão e princípios de design

**CONFIRMADO:** Beta 1.0 é uma paródia divertida da vida de motoboy no Brasil, não um simulador burocrático. Quatro personagens têm carreiras individuais, veículos, residências, zonas de atuação e coletas próprios. Casas podem ser simples desde que funcionais.

Princípios:
1. **Diversão antes do excesso de realismo:** operações reconhecíveis, animações breves, humor de bairro e agência do jogador.
2. **Consequências coerentes:** decisões alteram localização, custódia e resultado do pacote; nenhum volume desaparece da simulação.
3. **Interação rápida por padrão, aprofundamento opcional:** botão principal contextual e menu de alternativas, sem cinco telas obrigatórias por entrega.
4. **Cidade viva, Android leve:** reutilizar geometria e sistemas atuais, priorizar desempenho, acessibilidade e previsibilidade.
5. **Arquitetura evolutiva:** preservar a possibilidade futura de cooperativo, sem prometer multiplayer, backend ou economia completa nesta Beta.
6. **Progresso verificável:** blocos pequenos, aceitação objetiva, testes unitários, browser E2E e validação manual no dispositivo.

A Beta 1.0 está definida por um **ciclo diário completo, repetível e divertido**, não apenas pela quantidade de objetos novos.

### Sequência diária de ponta a ponta (todos os quatro motoboys)
| Horário virtual | Ação | Regra de jogo |
|---|---|---|
| 11h30 | Cada personagem em sua casa | Jogador se equipa; NPCs têm preparações curtas e próprias |
| 11h30–12h | Sair de casa, montar, alcançar lojas | Saídas variam pela distância real; não exigir espera artificial |
| 12h–14h | Coletar e guardar pacotes | Planejamento por proximidade e carga equilibrada |
| Até 14h20 | Retorno e descarga na base | 14h ideal; 20 minutos de tolerância para NPCs |
| 14h–15h/16h | Conferência, triagem e retirada das sacas | Funcionários e entregadores cooperam sem ocupação dupla |
| Após liberação | Montar carga do próprio setor e seguir rota | Baú/alforje/suporte com posições físicas |
| Até 21h | Entregar, negociar alternativas, registrar tentativas | Ação rápida contextual, humor e custódia verificável |
| Fim da rota/turno | **Cada um dos quatro volta para sua própria casa** | A carreira ativa aguarda chegada do jogador; NPCs também encerram o turno em suas casas |
| Encerramento | Resumo, checkpoint e próximo dia útil | Só o perfil selecionado recebe progressão de carreira, sem ganho offline dos outros |

**Regra explícita:** o retorno para casa vale tanto para o personagem jogável quanto para os três NPCs. Não basta despawnar os NPCs após a última entrega; a simulação deve manter trajetória, chegada e encerramento lógico. Renderização distante pode ser simplificada, mas as posições/estados continuam rastreáveis.



### Mapa dos nove módulos (sequência oficial)

**B1-00 é preparação de automação e aprovação, não um décimo módulo de jogabilidade.** O objetivo é permitir que cada um dos nove módulos seja implementado, testado, publicado para avaliação e, só com aprovação, liberado para o próximo. **O B1-00 ainda não foi implementado**; o deploy atual depende de autorização explícita e atualização intencional do arquivo-gatilho.

| Ordem oficial | Nome simples | O que será construído | Como o usuário verifica |
|---|---|---|---|
| **B1-01** | Personagens e carreiras | Escolher entre quatro carreiras, personalizar avatar, salvar progresso sem misturar perfis | Trocar entre quatro perfis e retornar sem alterar dinheiro, inventário ou data dos outros |
| **B1-02** | Casas e começo do dia | Quatro casas funcionais; vestir equipamento, sair às 11h30 e chegar à moto | Sair da própria casa às 11h30 e poder retornar sem colisões nem bloqueios |
| **B1-03** | Lojas e distribuição de coletas | Expandir para 12 lojas, 3 por setor, com coletas por proximidade e equilíbrio | 12 lojas alcançáveis, cargas equilibradas e retorno planejado à base |
| **B1-04** | Trânsito e corredor de motos | Moto do jogador e motoboys NPCs passando entre carros quando houver espaço | Ultrapassagens sem atravessar veículos e sem espera circular permanente |
| **B1-05** | Pacotes e capacidade da moto | Caixas de tamanhos diferentes, transporte nas mãos e arrumação no baú/alforjes | Volume, posição e posse preservados, mesmo após recarregar o jogo |
| **B1-06** | Base e separação de encomendas | Postos de trabalho, funcionários, descarga e triagem sem NPCs sobrepostos | Operação com demanda alta sem funcionários presos ou pacotes duplicados |
| **B1-07** | Entregas e escolhas do jogador | Campainha, morador, vizinho, local autorizado, tentativa e ação arriscada | Cada escolha mantém localização e estado correto da encomenda |
| **B1-08** | Sons, animações e humor | Movimentos expressivos, som da rua, moto, campainha e respostas dos moradores | Entrega audiovisual completa com áudio sincronizado e fluidez no Android |
| **B1-09** | Fim de expediente e próximo dia | Retornar para casa, resumo de ganhos, pendências e avançar calendário | Terminar e repetir um dia inteiro sem perder saves e sem progresso cruzado |

**Política de aceitação proposta:** implementar numa `feat/beta1-XX-...` baseada na `preview` aprovada; abrir PR para `preview`; CI/E2E verdes; integrar e publicar demonstração após gates configurados; registrar `AGUARDANDO APROVAÇÃO`; correção do mesmo módulo se reprovado; avançar só com aprovação explícita. Sem publicação automatizada antes do B1-00 ser aprovado e configurado. `main` só com autorização separada.

## 1. Situação atual vs. alvo Beta 1.0

| Área | Base conhecida LOG-006 | Meta Beta 1.0 |
|---|---|---|
| Personagens | Um jogador e três motoboys NPC fixos | Quatro personagens selecionáveis; um ativo, outros três controlados por IA |
| Carreira | Sem persistência de quatro perfis | Quatro carreiras isoladas e salváveis |
| Casa | Jornada inicia fora de casa | Quatro casas funcionais; preparar, sair, retornar, encerrar dia |
| Relógio | Começa às 11h45; NPCs saem 11h47 | Começa às **11h30**, em casa; saída de cada NPC conforme preparo e rota |
| Lojas | Oito | **Doze**, inicialmente três por setor |
| Pacotes | Inventário único e interação física simplificada | Formatos diferentes; até seis por viagem nas mãos, sujeitos à capacidade |
| Moto | Baú com representação visual limitada | Arranjo visível em baú, alforjes e suporte externo seguro |
| Base | Dez trabalhadores e NPCs; possíveis sobreposições | Postos, filas e deslocamento coordenado sem sobreposição |
| Corredor de motos | NPC motoboy segue rota de faixa e para quando o bloqueio dinâmico detecta um carro; LOG-006 evita um impasse específico com van | Motoboys e outras motos contornam filas de carros pelo corredor **quando houver espaço real**; sem bloqueio permanente ou colisão falsa |
| Entregas | Confirmação logística simplificada | Campainha, morador, vizinho, local autorizado, tentativa e ação arriscada |
| Áudio | Sem catálogo de efeitos de entrega definido | Motor, ações, ambiente, campainhas e falas curtas licenciadas |
| Animações | Caminhar, carregar, entregar, montar moto, abrir baú já existem | Equipar, tocar campainha, abrir portão, reagir, receber e arremessar |
| Fim do dia | Operação logística até 21h | Voltar à própria casa, resumo, salvar e avançar para o próximo dia |

**Limite de escopo:** continuar no navegador Android/desktop. Multiplayer real, mundo persistente em servidor, financiamento/garagem profunda e economia online permanecem expansões posteriores.

---

## 2. Módulo B1-01 — Personagens e carreiras

**CONFIRMADO:**
- Quatro personagens jogáveis, cada um com sua casa, veículo, setor e coletas. A opção já definida para o começo da carreira é ter **moto antiga ou carro popular antigo próprio e quitado**; detalhes de distribuição entre os quatro perfis continuam pendentes.
- Quatro carreiras individuais, não uma carreira compartilhada.

**PROPOSTO:**
- Tela inicial: quatro cartões de personagem mostrando nome, bairro/setor, residência, moto/veículo, dinheiro, reputação, dia da carreira e botão Continuar/Nova carreira.
- Apenas **um personagem controlado por vez**; os demais trabalham como NPCs no mesmo dia. A estrutura deve permitir futura conversão para jogadores cooperativos.
- Alternar carreira somente a partir do menu principal ou após encerrar a jornada; não transferir pacotes ao trocar perfil.
- Dados separados por identificador de carreira: personagem, casa, veículo, dia, equipamentos, progresso, dinheiro, reputação, inventário, ocorrências e histórico.
- Perfis inativos não acumulam dinheiro offline automaticamente. A presença dos outros três NPCs na carreira ativa não altera o saldo dos perfis inativos.
- Salvamento local versionado (preferencialmente IndexedDB), validação de schema, checkpoints e exportar/importar backup. Nenhuma integração paga.

**Teste de aceite:** criar quatro perfis, concluir um dia no perfil A, trocar para B e retornar a A sem misturar dinheiro, volumes, casa, calendário ou progresso.

## 3. Módulo B1-02 — Casas e começo do dia

**CONFIRMADO:** jornada começa às **11h30 na casa do personagem**; ele pega jaqueta, capacete, vai à moto, visita lojas, base e entregas, depois retorna a casa. Casa simples, funcional.

**Mínimo funcional de cada casa:**
- Quarto/área de preparação (iniciar turno, roupa e capacete).
- Guarda-roupa ou cabide com interação breve.
- Garagem/pátio com veículo próprio, baú e acesso à rua.
- Portão e zona de estacionamento com colisão/navegação válidas.
- Ponto para encerrar o turno, ver resumo e avançar calendário.

**PROPOSTO:** vestir jaqueta e capacete pode ser um comando único com animação rápida ou duas ações opcionais. Equipamento precisa ter estado visível; ausência dele gera aviso/restrição simples, sem rotina cansativa. Casas com interiores compactos, sem exigir quatro residências grandes e mobiliadas.

**Tempo:** a escala atual é uma hora virtual = 150 segundos reais. Assim, 11h30→12h00 dura apenas **75 segundos reais**. Usar preparação de poucos segundos e distribuição geográfica que permita alcançar o primeiro ponto; chegada antecipada à loja é válida, coleta apenas a partir das 12h.

**NPCs:** cada motoboy inicia na própria casa; a saída deve ser ajustada pela distância real da rua/rota e capacidade operacional. A regra antiga de sair todos exatamente às 11h47 deixa de ser universal para a Beta 1.0.

**Teste de aceite:** cada um dos quatro personagens nasce em sua residência às 11h30, equipa-se, alcança moto, sai pela rua sem clipping e consegue retornar ao mesmo local.

## 4. Módulo B1-03 — Lojas e distribuição de coletas

**CONFIRMADO:** lojas espalhadas pela cidade, aproximadamente 12 no total, com 3 a 4 por região; coletas influenciadas pela distância da residência.

**PROPOSTO para primeira versão:** 12 lojas no total, **três em cada setor Oeste/Norte/Leste/Sul**, distribuídas por ruas válidas. A residência é o ponto de partida do cálculo, não somente um elemento decorativo.

**Atribuição diária das coletas:**
1. Calcular custo **pela malha de ruas**, não apenas distância euclidiana.
2. Priorizar lojas próximas da casa e do setor próprio.
3. Equilibrar volume, capacidade da moto, tempo até a base e carga total dos quatro entregadores.
4. Evitar lojas inacessíveis, cruzamentos problemáticos e rotas inviáveis antes do retorno às 14h/14h20.
5. Permitir exceção entre setores somente para equilibrar demanda, com registro no plano do dia.
6. Congelar atribuições após a geração do turno, para que não mudem arbitrariamente durante coleta.

**Preservar:** dias fortes segunda/terça, médios quinta/sexta, fraco sábado; quarta/domingo mantêm comportamento provisório até decisão específica.

**Teste de aceite:** doze lojas aparecem nas rotas/3D, são alcançáveis e têm coleta válida; várias seeds/dias mantêm cargas equilibradas sem atrasos sistemáticos.

## 5. Módulo B1-04 — Trânsito e corredor de motos

**CONFIRMADO pelo usuário:** motos devem conseguir passar pelo corredor entre carros, como na rotina urbana de São Paulo. Trânsito comum de automóveis **não deve deixar motoboys presos indefinidamente**. Esta funcionalidade integra a **Beta 1.0**, não é pedido para alterar agora a versão pública.

### Problema identificado na implementação atual

O jogo já tem grafo de ruas e faixas em `src/core/city/roadGraph.ts`, veículos de tamanhos distintos no `src/core/city/traffic.ts` e roteamento de NPCs em `src/core/delivery/courierRoutes.ts`. Porém o motoboy NPC segue um caminho fixo e `Courier.travel()` em `src/core/delivery/couriers.ts` simplesmente interrompe o avanço quando `trafficBlocked` aponta veículo à frente. O teste LOG-006 verifica que uma van possa prosseguir e liberar a moto; **não implementa corredor de ultrapassagem**. Logo, o comportamento solicitado ainda não existe.

### Comportamento de produto

- **Moto do jogador:** conservar controle manual e física arcade calibrada na CTRL-002. Ao avistar fila de carros, o jogador pode passar entre eles com folga visível. O jogo não deve atrair automaticamente o guidão para o corredor nem impor travamento invisível por estar ao lado de um carro.
- **Três motoboys NPCs:** ao detectar fila de carros lentos/parados, avaliam um caminho local alternativo no espaço livre entre veículos/faixas, sinalizam visualmente a manobra, reduzem velocidade de maneira confortável, ultrapassam e retornam à trajetória de destino. Evitar ficar parados atrás de automóveis quando existe passagem.
- **Motos do trânsito ambiente:** comportamento semelhante, mas simplificado, para que a cidade não apresente duas regras contraditórias entre motos genéricas e entregadores.
- **Carros, vans, ônibus e caminhões:** seguem suas rotas normais, sem frear ou parar artificialmente só porque existe moto próxima. Estabelecer prioridade e ocupação compartilhada para evitar engarrafamentos circulares.
- **Sem corredor físico:** moto desacelera, espera uma abertura e, quando justificável, procura desvio permitido pelo grafo; **não atravessa carro, muro, calçada, pedestre ou portão**, nem teletransporta para cumprir prazo. O requisito de não ficar permanentemente preso não significa atravessar uma passagem impossível.

### Regras técnicas propostas

1. **Corredor como espaço de manobra, não nova via fictícia.** Calcular a faixa longitudinal disponível entre as caixas de colisão dos veículos e os limites reais da rua. Considerar largura da moto, suporte de carga/alforjes, margem lateral e distância longitudinal. Sem espaço, não autorizar.
2. **Decisão local em etapas:** `seguir faixa → fila detectada → avaliar passagem → reservar espaço → entrar no corredor → ultrapassar → retornar à rota`. Toda transição observável e reversível.
3. **Duas motos disputando o mesmo espaço:** reserva/precedência simples para não se atravessarem nem ficarem frente a frente. Cada uma cede passagem de modo determinístico.
4. **Velocidade moderada conforme folga:** diferença de velocidade em relação aos carros é limitada e diminui com o espaço lateral. Não usar corredor como atalho acelerado em qualquer circunstância.
5. **Cruzamentos, curvas sem visibilidade, pedestres, semáforos e portões:** interromper ou não iniciar manobra incompatível com a geometria ou regras do cruzamento; não ultrapassar artificialmente filas quando a saída estiver obstruída.
6. **Recuperação de travamento:** detectar ausência de progresso, classificar bloqueio (carro parado, sem passagem, jogador, semáforo, erro de rota), tentar manobra/desvio seguro e registrar diagnóstico se ainda bloqueado. Evitar `yieldingToTraffic` como estado que permanece indefinidamente sem reavaliação.
7. **Desempenho Android:** avaliar apenas veículos próximos e atualizar decisões em intervalos limitados; reutilizar rota por faixa, dimensões dos veículos, colisores e estruturas espaciais já existentes; não executar busca global cara a cada frame.
8. **Logística consistente:** usar o mesmo movimento físico de NPC para coletas, base, entregas e volta à casa. Nunca avançar pacote, horário de chegada ou etapa logística só porque houve bloqueio no trânsito.

**PENDENTE de calibração, não decisão de conceito:** folga lateral mínima, velocidade máxima no corredor, tolerância de desvio e tempo de reavaliação. Valores devem ser definidos com observação da geometria atual e testes no Galaxy S24, não inventados como regra legal.

### Critérios de aceitação B1-04

- Dois carros lentos/parados com corredor realmente livre: um motoboy NPC ultrapassa fisicamente, sem colisão, sem atravessar volumes e sem travar a circulação dos carros.
- Fila de vários veículos, com duas motos: ambas encontram passagem, negociam precedência e retomam a rota sem sobreposição.
- Via estreita ou caminhão/ônibus bloqueando totalmente: moto **não atravessa** o obstáculo; espera ou usa caminho alternativo seguro, com diagnóstico de bloqueio real.
- Cruzamento/semafórico/faixa de pedestres: circulação preserva regras e não atravessa pessoas ou veículos.
- Moto do jogador: passagem real entre carros sem controle artificial que a segure; colisões estáticas e dinâmicas permanecem válidas.
- Diferentes demandas, dias e densidades de tráfego: NPCs seguem progredindo na rota e alcançam a base sem esperas circulares permanentes; metas 14h/14h20 são monitoradas, **não garantidas por teleporte**.
- Testes unitários determinísticos + browser E2E com tráfego ligado + teste manual Android registrando fluidez, colisões, FPS e comportamento de motoboys.

**Ordem recomendada de implementação:** executar B1-04 **após B1-03 (novas lojas e rotas)** e antes de consolidar B1-06 (base), porque a circulação das motos influencia a chegada às lojas, o prazo de 14h20 e o retorno para casa.

## 6. Módulo B1-05 — Pacotes e capacidade da moto

**CONFIRMADO:** caixas de tamanhos diferentes; até **seis pacotes por vez** nas mãos; ver os volumes realmente organizados no baú. O que não couber pode ir a alforjes ou ser preso em suportes externos, inspirados em motos de entrega de São Paulo.

**PROPOSTO:**
- Classes físicas simples (envelope, pequeno, médio, grande, volumoso), cada item com largura, altura, profundidade, peso e ID único.
- Seis pacotes = **limite máximo de quantidade**, condicionado à soma de peso/volume e à possibilidade visual de transportar o conjunto; seis envelopes cabem, seis caixas enormes não.
- Capacidade baseada no espaço disponível, não só em quantidade de IDs.
- Armazenamento por slots/volumes tridimensionais: baú, alforje esquerdo/direito e suportes externos permitidos.
- Opção **Organizar automaticamente** como padrão; ajuste manual opcional e rápido; feedback simples quando faltar espaço.
- Carga externa usa cintas e limites de dimensão, peso e estabilidade. Não representar arranjos perigosos como escolha ideal.
- A tampa do baú abre, os pacotes têm posição visual coerente e sua ordem pode ser consultada. Não exigir organizar manualmente 50 caixas.
- Nenhum pacote troca de estado duas vezes nem some: retirar, levar nas mãos, guardar, descarregar, triar, retirar a saca, entregar e devolver são eventos de custódia rastreáveis.

**Nota técnica fundamental:** a entidade lógica do pacote permanece registrada mesmo quando seu modelo 3D é descarregado por distância. Ao retornar ao local, ele reaparece no último estado/posição persistidos.

**Teste de aceite:** pacotes de tamanhos diferentes encaixam ou são recusados coerentemente, sem interpenetração, perda, duplicação ou carga acima da capacidade. Testar recarga da página e retorno a endereço.

## 7. Módulo B1-06 — Base e separação de encomendas

**CONFIRMADO:** reorganizar funcionários da base para eliminar sobreposição e melhorar a rotina e o desempenho. Manter recebimento, conferência, triagem, quatro sacas e ajuda dos motoboys após descarga.

**PROPOSTO:**
- Estações com posições reserváveis: doca, fila de descarga, conferência, transferência, triagem por setor, armazenamento e expedição.
- Cada funcionário reserva um posto antes de caminhar; dois NPCs não ocupam o mesmo slot.
- Rotas com corredores de circulação, pontos de espera e prioridade, evitando cruzamento desnecessário.
- Se o caminho bloquear, replanejar ou ceder passagem; detectar travamento por tempo sem progresso e registrar diagnóstico. **Não teletransportar pacotes** para mascarar o bug.
- Animação detalhada apenas para NPCs próximos; longe da câmera, a lógica de tarefas continua e o visual usa simplificação.
- Preservar dez funcionários de base e ajuda dos entregadores após a descarga até que uma revisão explícita ajuste o quadro.
- Metas operacionais: chegada ideal 14h, tolerância 14h20, separação 15h normal / até 16h alta demanda; não declarar metas automaticamente cumpridas se houve bloqueio.

**Teste de aceite:** operações com demandas fraca, média e alta terminam com funcionários em postos válidos, sem sobreposição persistente nem pacotes teletransportados; logs mostram bloqueios e recuperações.

## 8. Módulo B1-07 — Entregas e escolhas do jogador

**CONFIRMADO:** descer da moto, pegar pacote, caminhar ao endereço, tocar campainha, aguardar morador ou escolher alternativa: vizinho, porta, caixa de correio, arremesso sobre muro ou não entregar. Pacote não pode desaparecer da cena.

**Fluxo preferencial:**
1. Estacionar e desmontar; abrir baú e selecionar **pacote do endereço correto**.
2. Caminhar até portão/caixa/entrada; destacar elemento interativo válido.
3. **Toque curto:** ação principal contextual (por padrão tocar campainha; depois entregar ao morador se disponível).
4. **Botão secundário:** abrir ações alternativas em lista curta; menu não interrompe o jogo desnecessariamente.
5. Evento de resposta: morador aparece, demora, recusa ou ninguém atende; variações rápidas e com humor.
6. Confirmação do destino físico e do status, com recibo/evento de jornada.

| Ação | Resultado proposto |
|---|---|
| Entregar ao destinatário | Animação de transferência + comprovante + status entregue |
| Entregar ao vizinho/porteiro autorizado | Identificar recebedor, destino e status entregue |
| Deixar em local autorizado | Pacote permanece fisicamente no local; status conforme autorização |
| Caixa de correio | Disponível apenas se o pacote couber e a entrega for permitida |
| Jogar por cima do muro | Minijogo arcade opcional com trajetória e risco de dano/reclamação; **não validar automaticamente como entregue** |
| Desistir/ninguém atende | Tentativa registrada; pacote continua com o motoboy até devolução/procedimento válido |

**PROPOSTO:** espera do morador normalmente entre 2–6 segundos reais e apenas ocasionalmente maior, para não tornar 50 entregas repetitivas. Mostrar opções situacionais, não cinco alternativas obrigatórias a cada endereço.

**Estados mínimos:** aguardando entrega, em mãos, entregue ao destinatário, entregue a terceiro autorizado, depositado com autorização, tentativa frustrada, danificado, extraviado/ocorrência, devolução pendente e devolvido. Cada transição precisa ter quem, onde, quando e motivo, com validação de duplicidade.

**Persistência física:** pacote abandonado/depositado tem ID e coordenadas do mundo; se sair da área de renderização, a posição continua salva. Transferência para o NPC recebedor pode terminar com o pacote armazenado no interior, mantendo o evento de posse, sem sumiço arbitrário.

**Teste de aceite:** todas as alternativas alteram exatamente uma vez estado/custódia e localização; reabrir o jogo não devolve pacotes já concluídos nem apaga os deixados no cenário.

## 9. Módulo B1-08 — Sons, animações e humor

**Direção:** humor de bairro brasileiro e respostas visuais curtas; evitar gritos/falas repetidos a cada entrega.

**Aproveitar o que já existe:** personagens com animações procedurais e IK para ficar parado, caminhar, carregar e estender pacote; moto já tem inclinação, montagem e tampa do baú. Não refazer o rig sem necessidade.

**Novas animações prioritárias:**
- Pegar/vestir jaqueta e capacete, guardar equipamento e abrir portão de casa.
- Estacionar, descer, destravar e abrir/fechar baú; retirar e acomodar caixas de dimensões variáveis.
- Apertar campainha, aguardar, acenar, reagir a cachorro, morador caminhar/abrir portão, transferência das mãos.
- Vizinho aceitar/recusar, deixar objeto na porta/caixa, arremesso arcade com queda/impacto.
- Base: fila, transporte de caixa, conferência e separação sem dois corpos ocuparem o mesmo espaço.

**Sons prioritários:** moto (partida/rotação/aceleração/desligamento), passos, capacete/fecho, baú, papelão, leitura/bip, campainha, portão, porta, cachorro, rua, fala curta, entrega confirmada e ocorrência engraçada.

**Implementação proposta:**
- Eventos de domínio separados dos efeitos: o mesmo evento pode acionar animação, som, legenda e feedback HUD; ausência de áudio/animação **não altera o pacote**.
- Sons sincronizados a marcos da animação (ex.: som da campainha no contato do dedo); volumes por categoria (motor, ambiente, vozes, efeitos, interface), mute e legendas.
- Usar áudio espacial apenas quando útil; limitar vozes simultâneas, reduzir detalhe com distância e liberar áudio após gesto do usuário no navegador móvel.
- Preferir sons originais ou CC0; registrar fonte, autor, licença, edição e tamanho em public/assets/ASSET_MANIFEST.md. Verificar licenças individuais; não copiar vozes, músicas, logos ou efeitos de jogos/plataformas comerciais.
- Toda fala em PT-BR pode ter texto de apoio. Situações cômicas devem ser variadas, mas não interromper o fluxo repetidamente.

**Primeira prova audiovisual:** uma casa + uma loja + uma residência de entrega com moto, campainha, morador, transferência e retorno, antes de espalhar efeitos por toda a cidade.

## 10. Módulo B1-09 — Fim de expediente e próximo dia

**CONFIRMADO:** cada entregador termina o trabalho, volta à sua própria casa e pode iniciar o expediente do próximo dia; quatro carreiras são independentes.

**PROPOSTO:**
- Ao terminar as entregas, objetivo vira **Voltar para casa**; moto/portão/área da garagem reconhecem chegada.
- Após concluírem suas rotas (ou encerrarem suas tentativas), os três NPCs retornam às casas individuais pelos trajetos da rua; registrar estado e hora de chegada. Falhas de caminho precisam de recuperação segura, não desaparecimento visual que simule chegada.
- Se não concluir tudo até 21h, pode parar, registrar não entregues e retornar: **não prender o jogador no expediente**. O horário de entrega termina às 21h; definir explicitamente se o relógio continua durante retorno após esse limite (PENDENTE).
- Na casa aparece resumo: recolhidos, entregues, tentativas, devoluções, reclamações, bônus e ganhos da jornada, tempo, reputação.
- Salvar checkpoint e avançar para o próximo dia útil da carreira atual. Recarregar os quatro perfis sem contaminação.
- Economia inicial deve refletir decisões existentes e remuneração por volume sem duplicidade, mas financiamento, oficina, compra avançada de veículos e expansão de garagem são **fora do escopo central** desta Beta, a menos que sejam solicitados.

## 11. Contratos de engenharia e qualidade

Entidades mínimas propostas:
- **CareerProfile:** ID do personagem, residência, veículo, setor, dia, equipamentos, dinheiro, reputação e snapshot.
- **DailyPlan:** seed, dia, classificação de demanda, lojas atribuídas, ordens de coleta, metas e região.
- **Parcel:** ID estável, dimensões/peso, origem, destinatário fictício, estado, detentor, posição de armazenamento, histórico e resultado.
- **Interaction:** alvo, distância, ações disponíveis, evento visual/sonoro e resultado validado.
- **NpcTask:** trabalhador, posto reservado, caminho, carga, estado, última evolução e motivo de espera.
- **WorldDrop:** pacote lógico com referência de localização e materialização visual sob demanda.

Invariantes obrigatórios:
1. Cada pacote tem exatamente um ID e uma custódia/posição lógica válida.
2. Um evento não remunera duas vezes nem pode concluir entrega antes da transferência válida.
3. Salvar/carregar não troca dados entre carreiras ou duplica inventário.
4. Horário virtual não altera a cadência de tarefas físicas de modo contraditório.
5. NPCs não atravessam paredes nem ocupam o mesmo posto reservado permanentemente; qualquer falha deve ser observável.
6. O pacote pode sair da memória gráfica por distância, **nunca do estado persistente** por causa disso.
7. O jogo não depende de rede, novas assinaturas ou permissões perigosas para funcionar.

Metas de teste e desempenho:
- Executar validação estrutural, TypeScript, build, unitários e E2E em cada etapa; testes representam comportamento real e não passam por enfraquecimento de assertivas.
- Browser com trânsito ligado, cenários de demandas alta/média/fraca, relançar o jogo entre operações, quatro perfis e dezenas de tentativas.
- Resoluções mobile 915×412 e 780×360; joystick, minimapa, HUD, texto e ações sem sobreposição.
- Objetivo de desempenho **a validar**, não resultado comprovado: jogo jogável de modo estável no Galaxy S24; medir FPS, picos de memória e temperatura no dispositivo. Reduzir partículas, áudio simultâneo, IA visual distante e geometria desnecessária.
- Verificação Android real **depende de teste no aparelho**; Chromium SwiftShader não comprova FPS real.

## 12. Blocos de implementação e dependências

| Sequência | Entrega | Demonstração mínima e gate |
|---|---|---|
| **Pré-requisito publicado** | HUD-001 + CTRL-001/MAP-001 e CTRL-002 | Preservar controles, tráfego, calendário e minimapa da `preview` atual |
| **B1-00 (preparação)** | Orquestração, gates e aprovação por módulo | Fluxo aprovação/reprovação testado sem publicar nem alterar o jogo |
| **B1-01** | Personagens e carreiras | Trocar entre quatro perfis e retornar sem alterar dinheiro, inventário ou data dos outros |
| **B1-02** | Casas e começo do dia | Sair da própria casa às 11h30 e poder retornar sem colisões nem bloqueios |
| **B1-03** | Lojas e distribuição de coletas | 12 lojas alcançáveis, cargas equilibradas e retorno planejado à base |
| **B1-04** | Trânsito e corredor de motos | Ultrapassagens sem atravessar veículos e sem espera circular permanente |
| **B1-05** | Pacotes e capacidade da moto | Volume, posição e posse preservados, mesmo após recarregar o jogo |
| **B1-06** | Base e separação de encomendas | Operação com demanda alta sem funcionários presos ou pacotes duplicados |
| **B1-07** | Entregas e escolhas do jogador | Cada escolha mantém localização e estado correto da encomenda |
| **B1-08** | Sons, animações e humor | Entrega audiovisual completa com áudio sincronizado e fluidez no Android |
| **B1-09** | Fim de expediente e próximo dia | Terminar e repetir um dia inteiro sem perder saves e sem progresso cruzado |

**Estratégia transversal:** antes de construir todas as casas/lojas, provar um **slice vertical** com 1 personagem, 1 casa, 1 loja, 1 pacote, 1 cliente e retorno à casa. Depois ampliar para quatro personagens e doze lojas. Isso reduz retrabalho e permite testar o ciclo real.

**Regra de entrega:** cada bloco começa com critérios e testes, usa branch de feature isolada, passa em CI/E2E, recebe revisão e só então integra à `preview`. A publicação automática **ainda não existe**: o B1-00 deverá implantá-la com gates técnicos, mantendo aprovação humana obrigatória antes de liberar o próximo bloco. Até lá, cada deploy segue exigindo autorização explícita. Nunca publicar na `main` por consequência deste plano.

## 13. Critérios de conclusão da Beta 1.0

A versão só pode ser anunciada **Beta 1.0 jogável** quando, no mínimo:
- Os quatro perfis funcionam e seus saves são isolados.
- Cada personagem inicia em casa às 11h30 e retorna à própria casa ao final.
- Doze lojas são acessíveis, coletas equilibradas e base recebe/triagem/expede sem bloqueios permanentes.
- Motos do jogador, motoboys NPCs e motos do trânsito ambiente conseguem usar o corredor quando há folga real; carros não geram espera infinita, e colisões/semáforos permanecem coerentes.
- Pacotes possuem dimensões, transporte até seis condicionado à capacidade, alocação visível e rastreamento fiel em todas as fases.
- Campainha, morador, vizinho e alternativas de entrega têm feedback visual/sonoro e consequências corretas.
- Entregas concluídas, pendentes, recusadas, arremessadas ou deixadas em local autorizado não somem do estado do jogo.
- É possível repetir jornadas, avançar dia e recuperar os saves após reinício.
- Os testes automatizados aplicáveis e um ensaio de navegador com trânsito estão aprovados; teste no celular é documentado como aprovado ou pendente, jamais inventado.
- A HUD/analógico/minimapa não sofrem regressão.

## 14. Questões pendentes (não inventar decisões)

1. Nomes/aparência/veículos específicos dos quatro personagens; variedade inicial de motos/carros e equipamentos.
2. Equipar-se é obrigatório uma vez por turno ou oferece atalho automático permanente?
3. O relógio continua após 21h durante o retorno à casa ou o encerramento exige estar em casa antes desse horário?
4. Capacidade exata de baú/alforjes/suportes e limite de peso das mãos por classe de volume.
5. Regras concretas de autorização de vizinho/portaria/porta/caixa, reclamação e resultado de arremesso.
6. Salvar apenas entre dias ou também checkpoints durante a jornada; política de migração de saves antigos.
7. Equilíbrio da economia/reputação do início da carreira e tipo de veículo inicial de cada personagem.
8. Quantidade inicial de falas e assets sonoros, e o limite de desempenho aceitável medido em aparelho.
9. Valores exatos de folga lateral e velocidade de corredor para motos, calibrados após validação da geometria e do desempenho real.

**Resumo operacional:** a Beta 1.0 deve tornar o dia de motoboy divertido, completo e repetível, com quatro carreiras, casa funcional, mais lojas, **motos usando corredor e sem travamentos por carros**, carga física, base organizada, escolhas de entrega e identidade audiovisual brasileira. O escopo deve ser construído em blocos auditáveis, não em um único megaprompt de implementação.
