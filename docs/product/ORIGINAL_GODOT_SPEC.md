# Brejo Alegre Delivery Simulator — Especificação-mestre congelada

**Versão do contrato:** 1.0 | **Data:** 10/11/2026 | **Estado:** decisões 01–16 confirmadas e preservadas; decisão 17 define a execução.  
**Natureza:** documento de requisitos, não relatório de implementação. Nenhum código, APK, teste ou mapa definitivo é declarado concluído.

## 0. Autoridade dos requisitos e interpretação

- Esta especificação registra as escolhas do usuário ao longo do `/grill-me`. Não autoriza substituí-las por decisões mais fáceis de desenvolver.
- **A decisão mais recente prevalece quando altera explicitamente a ordem de execução**, mas não revoga os demais requisitos. Assim, D13 fixa a arquitetura final autoritativa e D16 determina que a **primeira entrega seja uma demo visual 3D Android offline**, com servidor e logística implementados depois.
- O cenário temporário de D16 **não** modifica D09: o mapa definitivo exige **máxima fidelidade geográfica verificável a Brejo Alegre (SP)**. O mapa provisório deve ser rotulado como fictício/temporário.
- Itens marcados **PENDENTE** ou **PROPOSTA NÃO CONFIRMADA** não podem ser tratados como regras definitivas.
- O projeto não pode ser confundido nem compartilhar dados/segredos com outros projetos ou repositórios do usuário.

## 1. Visão do produto

Jogo de simulação profissional de coletas e entregas com motos e carros em uma representação 3D isométrica de **Brejo Alegre, SP**, inicialmente para **Android em modo paisagem**. Até **quatro jogadores humanos** compartilham uma sessão com relógio único, trabalhando em carreiras e patrimônios **individuais**. NPCs operam lojas, base logística, trânsito, apoio e parte da distribuição. Há cooperação opcional com entrega física e bipagem dos pacotes transferidos.

- Estilo: 3D semirrealista otimizado, visual e sons reconhecíveis do interior paulista; controles amigáveis ao touchscreen.
- Direção: moto com equilíbrio automático e inclinação visual; carro com física própria; carga e distribuição afetam comportamento e capacidade dentro de limites seguros.
- Progressão: cinco níveis de carreira, garagem, veículos e acessórios, sem gamificação agressiva e sem vantagem injusta para quem joga em grupo.
- Compatibilidade visada: 30 FPS sustentados em aparelho intermediário *a ser escolhido e testado*; 60 FPS como meta para aparelhos mais fortes, não como resultado já demonstrado.

## 2. Registro integral das decisões aprovadas

| ID | Decisão confirmada | Implicação obrigatória |
|---|---|---|
| D01 | Simulação equilibrada, meta flexível de **8–12 paradas distintas por humano** | Parada = endereço visitado; pode receber vários pacotes; meta condicionada a tempo/carga |
| D02 | Demanda dinâmica válida, gerada **antes das 11h**, para oito lojas | Manifestos coerentes de pacotes/plataformas/destinos; excedentes atendidos por NPCs |
| D03 | Capacidade física de moto e carro por compartimentos | Massa, dimensões, posição, alforjes, baú e suportes compatíveis; não usar limites fixos abstratos de unidades |
| D04 | **Um motor autoritativo de encomendas e custódia** | IDs únicos, eventos auditáveis, scans idempotentes e apps de plataforma separados sobre o mesmo estado |
| D05 | Salas persistentes com servidor dedicado e NPC de substituição | Até 4 humanos; sala privada por código primeiro, pública depois; sessão segue sem anfitrião |
| D06 | Simulação detalhada com interações ágeis | Dirigir, parar, descer, localizar, bipar e entregar; GPS na direção; operações complexas com veículo parado |
| D07 | **Pagamento por pacote físico efetivamente entregue**, uma única vez | Moto ML R$7, Shopee R$5; carro ML R$9, Shopee R$5; coleta R$0,50 por volume recebido na base |
| D08 | Física semirrealista otimizada para Android | Controladores específicos, equilíbrio assistido, trânsito NPC moderado, danos progressivos, servidor autoritativo final |
| D09 | **Máxima fidelidade geográfica a Brejo Alegre** | Ruas/conexões/cidades reais verificáveis; não adulterar distâncias da cidade para ajustar gameplay |
| D10 | Contingência híbrida | NPC visível perto, simulação simplificada longe; devoluções, socorro e estados auditáveis; expediente encerra às 21h |
| D11 | Carreira profissional realista e variedade | Cinco níveis, garagem, veículos, cooperação opcional, objetivos de longo prazo, sem pressão de login diário |
| D12 | 3D realista otimizado, identidade brasileira e distribuição Android | HUD legível, aplicativos virtuais com UI própria, áudio funcional, marcas e licenças tratadas corretamente |
| D13 | Arquitetura final modular, Godot 4.7.2 + GDScript tipado, servidor headless UDP, PostgreSQL, API enxuta e GitHub | Construção progressiva, regras críticas no servidor final, integridade e testes |
| D14 | Qualidade progressiva com gates de aceite | Testes automatizados, integração, aparelhos reais, geografia, 4 clientes e zero defeitos críticos conhecidos para beta/lançamento |
| D15 | **Começar imediatamente com recursos provisórios** | Não bloquear código esperando cartografia/arte finais; provisório não vira verdade geográfica |
| D16 | **Demo visual 3D e direção Android primeiro**, servidor e logística depois | Primeira entrega offline, pequeno mapa temporário, moto, câmera, touchscreen e personagem; preparar integração posterior |
| D17 | Congelar D01–D16 e preparar contrato + prompt executável para a 0.1 | Escopo fechado, pendências documentadas, entregáveis e evidências; não construir o jogo todo em um prompt |

## 3. Jornada operacional futura — NÃO implementar na v0.1

**Relógio único:** 1 hora virtual = 4 minutos reais; jornada 11:00–21:00 = até 40 minutos reais (quando não terminar antes).

1. **11h:** saída da residência/base de preparação e atribuições de coletas. O setor principal pode ser planejado previamente; consolidação regional conforme triagem (detalhe pendente).
2. **12h–14h:** coletas em até oito lojas fictícias, usando o aplicativo virtual TRACKen para volumes de ambas as plataformas. Cada volume precisa ser realmente transportado até a base.
3. **14h–15h:** NPCs recebem fisicamente, individualizam, verificam e agrupam por geografia. Divergências são registradas; nunca se apaga ou cria pacote magicamente.
4. **15h–16h:** NPCs preparam uma **saca principal lógica, mista ML + Shopee, por entregador**. O jogador confere pelo app virtual da plataforma correspondente e distribui a carga entre os compartimentos físicos do veículo. **PENDENTE:** horário exato em que pode sair antecipadamente, quando tudo estiver pronto.
5. **16h–21h:** entregas (saída antecipada quando autorizada). Meta flexível 8–12 endereços/paradas por humano, podendo variar conforme geografia real, tempo e carga. NPCs executam excedentes. Jogador pode encerrar antes, ir para casa ou auxiliar outro humano.
6. **21h:** fechamento da atividade humana, com recuperação administrativa audível/auditável dos volumes remanescentes, sem inventar entregas. Sala termina mais cedo se todos os deveres humanos já tiverem sido resolvidos.

O mapa definitivo manterá oito lojas e **50 endereços ativos**, inicialmente distribuídos por quatro **setores logísticos operacionais** com alvos 14, 12, 11 e 13. Rótulos históricos de trabalho: Centro, Jardim Primavera, Vila Sul, Parque das Palmeiras. **Não afirmar que são bairros reais ou oficiais de Brejo Alegre** até verificação; a distribuição pode ser ajustada com aprovação se não couber na geografia real. Os endereços devem ser acessíveis por carro/moto e a pé; endereço, ponto de estacionamento e portão são referências diferentes.

## 4. Pacotes, escaneamento e operações — implementação posterior

Cada volume físico terá, no mínimo: `package_id` interno imutável único; ID do pedido comercial distinto; origem, destino e setor; plataforma ML ou Shopee; dimensões, peso, fragilidade; condição; estado operacional; responsável atual; histórico imutável de eventos e idempotency key por operação.

- Um único **motor de estado de pacote**; TRACKen e aplicativos próprios de ML/Shopee são interfaces de etapas diferentes do mesmo motor, não bancos de pacotes separados.
- Scanner por **câmera virtual dentro do 3D**, mirando etiqueta visível e próxima do personagem; sem câmera física, OCR ou exigência de API externa. Leitura confirmada pelo servidor e feedback visual/sonoro/tátil.
- Scan repetido não muda estado nem remunera de novo. App errado, volume não presente ou responsável incorreto devem impedir transição.
- Recebimento na base exige confirmação física do NPC. Uma divergência, p.ex. 16 manifestados versus 15 presentes, abre exceção rastreável e permite prosseguir com os 15 corretos.
- Transferência entre humanos exige encontro físico, capacidade válida, leitura pela plataforma do destinatário e troca atômica da custódia; transferências parciais permitidas, sem remuneração extra.
- Falha na entrega não gera pagamento; pacote permanece fisicamente custodiado e segue para devolução/apoio, com confirmação no recebimento pelo NPC.
- Destinatário, porteiro autorizado, ausência, recusa, acesso bloqueado, endereço divergente, dano e extravio devem corresponder a eventos válidos do jogo, não somente a botões exploráveis.
- NPC de suporte/substituto que efetivamente entrega não gera renda nem XP ao jogador desconectado. Nunca pagar a entrega duas vezes.

## 5. Economia e carreira — implementação posterior

Todos os valores financeiros devem ser representados em **centavos inteiros**, com razão de lançamentos imutáveis/idempotentes e transações persistentes.

| Serviço concluído | Remuneração do humano que o executou |
|---|---:|
| Coleta de um pacote, após recebimento físico na base | R$ 0,50 |
| Entrega ML por moto | R$ 7,00 por pacote |
| Entrega ML por carro | R$ 9,00 por pacote |
| Entrega Shopee por moto | R$ 5,00 por pacote |
| Entrega Shopee por carro | R$ 5,00 por pacote |
| NPC entrega, tentativa malsucedida, devolução ou simples transferência | R$ 0,00 para o jogador |

**Pagamento por volume físico, não por parada, endereço ou pedido comercial.** Custos operacionais auditáveis (combustível, manutenção, colisão, equipamento), sem débitos duplicados: consumo de combustível pode ser calculado por km, mas a despesa deve ser registrada conforme regra única ao reabastecer. Causas de defeitos atribuíveis a NPCs ou problemas técnicos não devem penalizar injustamente a carteira do jogador. Carreiras individuais e XP separados da carteira, cinco níveis, garagem, compra/upgrade de motos e carros sem bloqueio artificial de progressão. Iniciante não pode ficar sem opção de trabalhar por falta de dinheiro (veículo de serviço ou alternativa apropriada). **Preços e efeitos econômicos de equipamentos ainda não aprovados. Bônus de equipe 5%/10% ainda não aprovado.**

## 6. Veículos, NPCs e câmera — implementação final

- Física **semirrealista**, não simulação instável de equilíbrio puro. Moto com equilíbrio assistido e inclinação visual/funcional; carro com controlabilidade distinta, ré, frenagem e manobras. Carga afeta aceleração, frenagem e estabilidade conforme massa e distribuição, respeitando segurança e compatibilidade de baús/alforjes/suportes.
- Interface Android horizontal: aceleração, freio, direção, entrada/saída de veículo, câmera rotativa, zoom, transparência/oclusão de casas quando necessário. Operações complexas só com veículo parado.
- Trânsito NPC moderado: cruzamentos, faixas e sentidos reais; proximidade dos jogadores simulada, NPC distante simplificado. Dois jogadores veem os mesmos NPCs relevantes.
- NPCs para lojas, armazém, entregas excedentes, atendimento e contingências. Monitorar tarefas paradas, recuperar rota/atribuição, limitar retentativas, auditar última solução; nunca teletransportar silenciosamente um pacote para contar como entregue.
- Sala persistente num servidor dedicado, independente do anfitrião. Novos jogadores entram antes do início da jornada; reconexões durante a sessão permitidas. Após detecção da desconexão, NPC assume personagem e carga e continua; janela inicial de reassunção proposta de **60 segundos reais**, com controle exclusivo.

## 7. Mapa definitivo e limites de fidelidade

- **Brejo Alegre, São Paulo, real e geograficamente verificável.** Preferir fontes cartográficas e referências cuja origem e licenças possam ser registradas; validar ruas, cruzamentos, sentidos, acessos e o perímetro urbano escolhido.
- Não fabricar ruas, encurtar distâncias, ajustar quarteirões reais ou representar nomes de setores fictícios como oficiais. Lojas/clientes podem ser fictícios e posicionados coerentemente na malha.
- Registrar proveniência, data de referência, lacunas, licença e grau de confiança para cada camada geográfica; GPS final baseado num grafo navegável; malha de pedestres separada.
- Se o ritmo de 8–12 paradas em 20 minutos for incompatível com a escala real, **documentar conflito e submeter ajuste de carga/tempo**, sem falsificar o mapa.
- **Para v0.1 exclusivamente:** rua/casas/placeholders fictícios e visivelmente identificados como `ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE`. Dados e geometrias devem poder ser substituídos sem reescrever os controladores.

## 8. Arquitetura-alvo (posterior à v0.1)

- Motor: Godot **4.7.2**, GDScript tipado. Cliente Android 3D e servidor dedicado Godot headless.
- Multiplayer por ENet/UDP; o servidor é autoridade sobre relógio, NPCs, movimentação válida, pacotes, custódia e pagamentos. Cliente faz apresentação, captura de controles e previsão local de movimento, com reconciliação quando necessário.
- API enxuta para identidade, sessões/carreira e persistência; PostgreSQL para ledger, eventos de pacotes e progresso. Arquitetura modular em repositório exclusivo, evitando serviços distribuídos prematuros.
- Desenvolvimento local primeiro. VPS com UDP público quando testes remotos justificarem. Não contratar Railway/servidores/assinaturas por conta própria; Railway não é dependência da v0.1.
- GitHub com branches, PRs, CI e testes. Segredos e certificados nunca no código. Defeitos críticos e pagamentos duplicados bloqueiam promoção de estágio.

## 9. Produto, UX, propriedade intelectual e lançamento

- Estética realismo 3D otimizado, arquitetura e paisagem brasileira, áudio de motores/bipagem/ambiente; gráficos adaptativos e controles touchscreen de alta legibilidade.
- Interfaces do coletor e marketplaces **originais**, sem copiar telas/logotipos protegidos ou insinuar parceria comercial. ML, Shopee e TRACKen são nomes funcionais da especificação; aprovação legal/licenças ou marcas fictícias antes da publicação.
- Sem chat público livre/voz aberto na primeira versão; cooperação com mensagens curtas predefinidas. Desenvolvimento de salas públicas após salas privadas estáveis.
- Android com APK para testes e AAB de distribuição conforme políticas vigentes e dispositivos compatíveis. Privacidade, licenças, dados de usuários e requisitos de teste da loja tratados antes do lançamento, não exigidos para compor a demo local.

## 10. Gates de qualidade do projeto

| Marco | Conteúdo | Evidência mínima |
|---|---|---|
| **0.1** | Demo visual 3D e direção Android, **offline** | Projeto Godot executável; condução; câmera; personagem; controles touch; exportação APK testada ou bloqueio documentado |
| **0.2** | Cliente + servidor Godot, relógio oficial e sincronização | Processos separados, logs, conexões e reconciliação |
| **0.3** | Loja, coleta, base, NPC, leitura, entrega e pagamento | Ciclo ponta a ponta persistente; não duplicar dinheiro ou carga |
| **1** | Multiplayer 2 e 4 jogadores, reconexão e NPC substituto | Testes de rede e custódia consistentes |
| **2** | Cartografia real validada, 8 lojas, 50 endereços e 4 setores | Auditoria geográfica e navegação em todos os destinos |
| **3** | Física completa, carro, carga, carreira, custos, contingência | Partidas completas e testes de recuperação |
| **4** | Beta/lançamento | Testes Android reais prolongados, sem P0/P1 conhecidos, revisão de publicação |

Os marcos numéricos acima são **rótulos organizacionais**, não versões de software já lançadas. Não declarar sucesso com testes sintéticos quando a integração verdadeira não foi executada. Não exigir integrações futuras para aprovar a demo 0.1.

## 11. Escopo EXATO da primeira entrega 0.1

### Dentro do escopo

1. Projeto Godot 4.7.2 legível e executável, com orientação paisagem e configuração Android preparada.
2. **Cena temporária simples**: solo/asfalto, cruzamento, calçadas, algumas casas em blocos, ponto de estacionamento; etiqueta visível de protótipo não cartográfico.
3. **Moto utilitária genérica** controlável por aceleração, freio e direção, equilíbrio assistido e inclinação visual. Não usar logotipos oficiais.
4. **Personagem 3D simples** para montar/desmontar, ficar parado e caminhar; controle exclusivo de moto ou personagem.
5. **Câmera isométrica** que segue alvo, gira e aproxima/afasta; evita perda permanente de visibilidade.
6. **Controles na tela** funcionais para Android horizontal, sem dependência exclusiva de teclado/mouse; teclas de debug opcionais.
7. Organização modular: separar entrada, modelo de estado, simulação local, física, apresentação da moto/câmera e dados da cena. Criar uma fronteira simples para futura autoridade remota, **sem implementar rede por antecipação**.
8. README com instruções de execução, recursos/licenças, testes realmente realizados, dependências e pendências; commits se Git disponível.
9. Tentar exportar APK se ambiente possuir JDK/SDK/templates adequados; caso não, registrar qual dependência falta e o comando/etapa para reproduzir, **sem declarar APK concluído**.

### Fora do escopo (proibido antecipar)

ENet, servidor, banco, autenticação, matchmaking, GPS com A*, mapa real definitivo, 8 lojas, 50 endereços, scanner, pacotes, TRACKen operacional, apps ML/Shopee, carreira, contabilidade, NPC logístico, carro, tráfego de cidade completa, backend pago, compra de assets ou publicação Play. Inserir apenas pontos de extensão mínimos onde se justifiquem.

### Aceite da 0.1

- O projeto abre na Godot fixada e uma execução no desktop ou ambiente equivalente é demonstrada, sem erros bloqueantes.
- O personagem consegue conduzir, frear, esterçar, parar, desmontar, caminhar e montar novamente, sem input simultâneo nos dois estados.
- A câmera isométrica segue o alvo adequado e permite zoom/rotação, com controles visíveis em orientação horizontal.
- A moto permanece controlável em baixa velocidade e parada, sem tombar por oscilação numérica incontrolável.
- Não há conteúdo identificado falsamente como geografia real ou marca autorizada.
- Documentação, licenças e relatório de testes distinguem **implementado / testado / não testado / bloqueado**.
- APK efetivamente exportado e testado, quando o ambiente permitir; se não permitir, **aprovação apenas parcial quanto ao requisito Android**, com bloqueio documentado.

## 12. Governança do agente e entrega

- Antes de editar, verificar repositório/diretório e ferramentas. Não assumir acessos inexistentes.
- Não acessar nem modificar outros repositórios, nem realizar deploy, contratar serviços ou publicar sem autorização.
- Preservar o trabalho preexistente, caso haja projeto compatível; usar branch específica para a 0.1 e commits pequenos. Não mesclar diretamente em `main` sem autorização.
- Limitar implementação ao contrato 0.1. Após duas tentativas equivalentes sem progresso, diagnosticar e evitar loop de ferramentas/tokens.
- Relatório final: arquivos criados/alterados, decisões de engenharia, comandos/testes executados e resultado real, caminhos do APK se existir, hash do commit se existir, bloqueios, próximo passo.

**Acompanhar:** `02_PENDENCIAS_E_RISCOS.md` e `03_PROMPT_FABLE_0_1.md`.
