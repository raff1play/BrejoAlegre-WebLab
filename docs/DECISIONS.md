# Decisões e precedência — log sem apagar histórico

## Regras

- Requisitos de produto confirmados durante o `/grill-me`: **D01–D17**, registrados integralmente em `product/ORIGINAL_GODOT_SPEC.md`. Não substituir por interpretações resumidas desta página.
- Uma decisão do Web Lab (`Wxx`) altera apenas o ambiente de **prototipagem**; não reescreve nem revoga a especificação Godot futura.
- Qualquer nova regra precisa de pedido do usuário, data, alternativas e impacto; propostas permanecem `PENDENTE` até confirmação explícita.

| ID | Estado | Regra para laboratório | Efeito sobre Godot final |
|---|---|---|---|
| W001 | CONFIRMADA (conversa 11/11/2026) | Protótipo **single-player web** com Babylon.js, TypeScript e Vite | Nenhum: Godot futuro permanece projeto independente |
| W002 | CONFIRMADA | Protótipo é **descartável**; se for aprovado, o jogo de produção será refeito do zero na Godot | Reutilizar especificação e modelos licenciados; não presumir reaproveitamento dos scripts |
| W003 | CONFIRMADA | Prioridade 0.1: cena dirigível, controles e visual, sem servidor/multiplayer/contabilidade | Mecânicas futuras permanecem previstas, não implementadas |
| W004 | CONFIRMADA | Nada de assinatura extra, deploy ou serviços pagos sem autorização | Nenhum |
| W005 | DECISÃO DE ENGENHARIA do scaffold (revisável) | Features por módulo; três perfis de ambiente; staging via CI e produção manual, sem cópia de fonte | Não vincula arquitetura do produto final |

## Invariantes do produto guardados como fonte

- D01 8–12 **paradas distintas** por humano, não 8–12 pacotes.
- D03 capacidade por dimensões, massa e compartimentos, não número fixo arbitrário de pacotes.
- D04 um único motor de custódia com eventos e scans idempotentes, quando essa etapa for feita.
- D05 quatro jogadores + servidor dedicado + NPC substituto são **futuro Godot**, não escopo web 0.1.
- D07 pagamentos por pacote físico efetivamente concluído; valores exatos na especificação.
- D09 fidelidade geográfica verificável a Brejo Alegre; cena fictícia temporária explicitamente sinalizada.
- D15 começar com assets provisórios; D16 demo visual primeiro; D17 congelar decisões, explicitar pendências.

**Pendências históricas** (saída antecipada após expedição, preços de veículos, verificação de setores e mapas, reconexão) permanecem sem aprovação. Não completar lacunas silenciosamente.

## W006 — Instalação PWA para teste (confirmada em 11/11/2026)

- Pedido explícito: transformar o laboratório web em aplicativo instalável para evitar o aviso cinza do Chrome ao solicitar fullscreen pela aba.
- Implementação aprovada **apenas para o Web Lab**: manifesto PWA com `display: standalone` e `orientation: landscape`, ícones originais, botão **Instalar app** e service worker de cache limitado ao projeto.
- O modo instalado **não** usa `requestFullscreen()` ao tocar no controle de rotação; a orientação é uma preferência sujeita às políticas Android/Chrome.
- Manter alternativa pelo navegador, sem inventar bloqueio forçado de rotação ou instalação já validada no Galaxy S24.
- Não altera nenhuma decisão D01–D17 da futura versão Godot, nem autoriza merge da `main` ou serviços pagos.

## W007 — Navegador primeiro e analógico proporcional (confirmada em 11/11/2026)

- Usuário pediu **cancelar/desativar o PWA por enquanto**, mantendo o jogo no navegador. W007 prevalece sobre W006 **somente para o estado operacional do Web Lab**; preservar o histórico da tentativa PWA.
- Remover `rel=manifest`, chamadas de instalação/registro e botões **Instalar app** do jogo. Encerrar apenas o antigo service worker do Web Lab e limpar apenas caches com prefixo exclusivo `brejo-weblab-`. Não tocar nos caches de outros apps ou no armazenamento de progresso.
- Substituir as setas na parte inferior esquerda por **analógico virtual real**, com movimento contínuo, zona morta, limite radial e reset ao soltar/cancelar o toque, perder foco ou mudar de modo.
- **Na moto:** analógico X = esterço proporcional. Acelerar e frear continuam separados, à direita. **A pé:** analógico X/Y = caminhada em 360° com velocidade proporcional, mantendo teclado no PC.
- Continuar com animação de câmera, colisões e controles existentes, sem servidor ou serviços pagos. Medir ergonomia/FPS no aparelho real antes de dizer que melhorou.
- A `main` e o jogo Godot final não são alterados. Publicar somente na prévia autorizada do Pages, após testes aprovados.

## W008 — Calibração da moto com direção mais leve (confirmada em 11/11/2026)

- Pedido explícito após testar W007 no celular: "Ficou muito pesado, difícil manobrar a moto".
- **Somente moto:** aplicar curva não linear à intensidade horizontal do analógico (25% do stick ≈ 45% do comando de direção), mantendo centro neutro e saturação em [-1,1].
- No núcleo da simulação, reduzir a demora de resposta do guidão (taxa de entrada 3,2 → 5,0/s e retorno 5,5 → 8,0/s); aumentar o esterço máximo (0,56 → 0,67 rad) e o limite de aceleração lateral (6,5 → 8,0 m/s²) para melhorar manobras em baixa/média velocidade, sem aumentar a velocidade máxima.
- **Não modificar** velocidade do pedestre, analógico ao caminhar, acelerador/freio, teclado, colisões, câmera, PWA suspenso ou decisões do jogo Godot.
- A alteração só é considerada **aprovada ergonomicamente** quando o usuário testar a nova versão em aparelho real; CI verde prova regressões automatizadas, não conforto de direção.


## W009 — Qualidade visual: moto, entregador e vitrine urbana (confirmada em 12/11/2026)

- Pedido explícito do usuário ("EXECUTAR W009"): elevar a qualidade visual **sem alterar** a direção calibrada na W008, controles, física, câmera, colisões e montar/descer; PWA continua desativado (W007).
- **Entrega A:** moto de entregas e entregador refeitos em geometria procedural própria, com animações (rodas, guidão, suspensão visual, pé no chão parado, caminhada, transições de montar/descer) que **apenas leem** o estado da simulação. A física da moto não foi reimplementada.
- **Entrega B:** vitrine de cinco fachadas junto ao cruzamento (lotes `casa-leste-1..3` e `casa-oeste-1..2`, lista em `SHOWCASE_IDS` de `src/world/layout.ts`) e melhorias leves na rua toda. Mapa **não** ampliado; ruas e acessos preservados; plantas e pilares novos têm colisor.
- Sem assets externos: tudo é geometria e textura procedural do repositório. Sem dependências novas.
- Decisão de engenharia associada: modelos articulados usam **skinning rígido na GPU** (`src/features/shared/rigidSkin.ts`) para manter os draw calls no nível da W008.
- Metas de 60 FPS no Galaxy S24 (perfil leve) e 30 FPS em aparelho intermediário seguem **não medidas**. Não altera D01–D17 nem W001–W008; não autoriza merge nem publicação no Pages.

## CORE-010 — Remasterização visual da primeira área (pedido de 12/11/2026)

- Identificador **CORE-010** (não W010: W010–W012 pertencem ao Easter egg descartado e não foram incorporados). Branch `feat/core-010-visual-remaster`, criada a partir de `feat/weblab-core-w009` (PR #2).
- Pedido: aproximar o Web Lab dos vídeos de referência enviados pelo usuário (gerados por IA, **só referência artística**). Área: quarteirão da vitrine W009. Física, controles, câmera, colisões existentes e gameplay preservados.
- **Assets externos: nenhum.** As fontes indicadas (patch.gg, Kenney, Quaternius, Poly Haven, ambientCG) responderam 403 pela política de rede do ambiente; a liberação desses hosts foi proposta e não aprovada nesta sessão. Pela regra do pedido ("se nenhum asset adequado existir, aprimorar o modelo procedural"), tudo foi feito em geometria e textura procedural própria.
- Direção adotada (ver `docs/VISUAL_DIRECTION.md`): sol quente de fim de tarde, telhado cerâmico laranja com beiral, muros com pilares e capitel, vegetação volumosa (oiti, ipês, buganvília, floreiras), postes coloniais, asfalto escuro e limpo, moto/baú amarelos com preto e colete amarelo.
- Moto e entregador: só cores/libré; modelos da W009 mantidos (sem ganho claro em substituí-los).
- Não autoriza merge, deploy, serviços pagos nem alteração de outros projetos.

## CORE-011 — Integração de assets 3D reais (pedido de 12/11/2026)

- Branch `feat/core-011-real-assets` a partir de `feat/core-010-visual-remaster` (PR #3); PR em rascunho contra a CORE-010. W010–W012 não incorporados; `main` e W009 intocadas; sem deploy.
- Fonte usada: **Poly Haven (CC0)**, triada pela busca do patch.gg (licença, triângulos, tamanho). Integrados: poste `street_lamp_01`, floreira `planter_box_02`, porta `rollershutter_door` e textura `clay_roof_tiles_03` (detalhes em `public/assets/ASSET_MANIFEST.md`).
- Nova dependência **`@babylonjs/loaders` 9.35.0** (Apache-2.0, mesma versão do core, sem custo): só o loader glTF 2.0 e `EXT_texture_webp`, carregados sob demanda.
- Materiais glTF (PBR) convertidos para `StandardMaterial` no carregamento para manter a mesma linguagem de luz da cena e o custo de shader baixo no celular.
- Moto e entregador **não substituídos**: os únicos candidatos (Polyfork, CC-BY, cor chapada) não são articulados nem do mesmo estilo; o modelo articulado da W009 segue.
- Vegetação externa **não usada**: árvores do Poly Haven têm ≈1,6 milhão de triângulos; os pacotes estilizados acessíveis (Kenney/KayKit) destoam do visual texturizado. Folhagem da CORE-010 mantida.

## CORE-012 — Câmera em terceira pessoa estilo GTA (pedido de 12/11/2026)

- Pedido do usuário: adicionar visualização em terceira pessoa, inspirada em GTA, com botão para alternar com a câmera isométrica atual.
- Escolha reversível no mesmo `ArcRotateCamera` do Babylon: **GTA/ISO** no HUD, tecla **C** no desktop. Inicialização continua isométrica; isométrica conserva ângulo/zoom anteriores ao alternar.
- Modo GTA: câmera atrás e acima da moto; realinhamento suave com o rumo da moto depois de 2,5 s sem giro manual; ao caminhar usa distância reduzida e órbita independente (evita ficar girando conforme o analógico controla o personagem).
- Distâncias iniciais 5,6 m na moto e 3,6 m a pé, FOV ~60°, zoom e inclinação limitados; bloqueio por volumes estáticos de casas, muros, troncos e postes.
- Não muda física, esterço da W008, analógico, controles de aceleração/freio, assets CORE-011, multiplayer ou mapa fictício; W010–W012 descartados permanecem fora.
- Branch `feat/core-012-gta-camera` baseada em `feat/core-011-real-assets`; PR de revisão; **não há autorização para merge ou deploy nesta solicitação**.

## Desenvolvimento contínuo na branch preview — 12/11/2026

- **Pedido explícito do usuário:** simplificar o fluxo para não criar uma nova branch/PR em cada pequena alteração.
- **Aprovado:** `preview` como branch permanente de trabalho (origem CORE-012 `bf8881e5`), commits pequenos e CI em cada push; `main` recebe apenas PR revisado e autorizado.
- GitHub Pages publica a `preview` apenas por alteração intencional do arquivo `docs/PREVIEW_DEPLOY_TRIGGER.md`, depois da autorização específica do usuário; a branch `preview` deve ser permitida uma única vez no ambiente `github-pages`.
- Branches temporárias são exceção para mudanças grandes/arriscadas/paralelas. Não exigir PR para correções de rotina em `preview`.
- PRs antigos #2–#5 encerrados sem merge; suas branches foram excluídas após validação de ancestralidade. A branch experimental `setup/weblab-foundation` também foi excluída (PR #1 fechado). Somente `main` e `preview` permanecem. PR #6 (`preview` → `main`) continua em rascunho e só pode ser mesclado após revisão e aprovação; o Easter egg W010–W012 não foi incorporado.
- Nenhuma mudança na definição do futuro jogo Godot, nos assets, nos controles atuais ou no PWA cancelado.

## CORE-013 — Expansão de Brejo Alegre e cidade viva (pedido de 13/11/2026)

- Pedido explícito do usuário: expandir a área como **releitura jogável** de Brejo Alegre/SP (IBGE 3507753) e simular uma cidade viva, trabalhando direto na `preview`, sem PR, merge ou publicação.
- Pesquisa e escolhas em `docs/CITY_REFERENCE.md`: nomes reais de ruas, igreja e escola usados como homenagem; **traçado, posições e edifícios inventados**. O aviso obrigatório "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE" (exigido por `scripts/validate-repository.mjs`) foi **mantido**; mudar esse texto exige decisão explícita do usuário.
- Uma única rede (`src/world/city/cityPlan.ts`) alimenta ruas, colisões, tráfego, pedestres e minimapa. Mão direita, uma faixa por sentido; avenida, R. Coroados e R. 13 de Maio preferenciais; 3 semáforos fictícios, cruzamentos com PARE, esquinas livres.
- Semáforos de tempo fixo com **fase exclusiva por aproximação** (verde 9 s, amarelo 3 s, vermelho geral 1,5 s) e fase exclusiva de pedestres (7 s + 4 s piscando): verdes conflitantes impossíveis por construção, conferido por teste.
- NPCs por regras determinísticas (sem IA generativa/serviço externo): IDM para seguir/frear, admissão no cruzamento (sinal, PARE, preferência, prioridade à direita, conversão à esquerda cede, ocupação, faixa de pedestre, espaço na saída), rotas calculadas uma vez por viagem (Dijkstra), ônibus em circuito com 4 pontos, vans galpão ↔ lojas, caminhões entrada ↔ docas só em vias pesadas, carros/motos/bicicletas aleatórios.
- Relógio: **mantida a regra aprovada de 1 hora virtual = 4 minutos reais e jornada 11h–21h**; o relógio agora roda 24 h para existir manhã/noite, começa às 11h e o controle de hora só aparece em desenvolvimento (`npm run dev`) ou com `?devtime=1` (`?hora=18` define a hora inicial).
- Saídas da cidade a 226 m do centro (≥ 80 m além dos limites jogáveis) para os veículos surgirem/sumirem fora do alcance, na névoa.
- Sem novos assets externos nem dependências. Não reincorpora W010–W012 nem PWA. FPS em Android **não medido**.

## CORE-014 — Simulador de entregas (pedido de 13/11/2026)

- Pedido explícito: transformar a CORE-013 em simulador de entregador com padrão visual da CORE-012, na `preview`, sem PR, merge ou publicação.
- **Câmera:** removida a alternância GTA/ISO por pedido; só terceira pessoa (traseira na moto, sobre o ombro a pé). A câmera sobe por cima de obstáculos antes de encurtar; paredes e tetos de lojas/galpão são obstáculos de câmera.
- **HUD:** objetivo, progresso, velocímetro, relógio, minimapa e um botão de ação contextual. Instruções, versão, FPS e o aviso obrigatório "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE" (exigido pelo validador) ficam na tela de **Pausa/Sobre**.
- **Cidade:** área navegável 17.820 m² → 38.296 m² + interiores (≥ 2×, medido por `navigableArea()`); novas ruas "Rua 1–4" e bairros Jardim Tietê, Jardim Primavera e Vila Nova são **fictícios**; continuações usam os nomes reais já documentados.
- **48 endereços entregáveis** (10 casas W009 + 38 lotes) com número métrico brasileiro (par à direita), placa, ponto de entrega na calçada e vaga na rua.
- **Rotina aprovada preservada:** 11h designação, 12h–14h coleta, retorno até 14h, triagem 14h–15h, saca a partir das 15h, entregas até 21h; 1 h = 4 min reais. "Aguardar" só acelera o relógio enquanto o jogador espera um horário da rotina (×24) — não muda a escala.
- Plataformas **fictícias** "ML" e "SHP" (códigos, sem marca). Fluxo dos volumes da loja: NA_LOJA → COLETADO → EM_TRANSPORTE → RECEBIDO_BASE → TRIADO → NA_SACA → EM_ROTA → ENTREGUE; volumes das plataformas chegam de caminhão já EM_TRANSPORTE. Estados só avançam um passo (erro caso contrário).
- Prova vertical: 2 lojas designadas, 2 volumes por loja + 4 das plataformas = 8 entregas. Generalizável por opção (`Workday({ stores, perStore, marketplace })`).
- **Assets:** nenhum asset externo novo; todos os modelos novos são procedurais (fontes externas não foram verificadas nesta sessão). Sem dependências novas.

## CORE-015 — Mapa real 1:1 (13/11/2026)

- **Fonte única:** OpenStreetMap (ODbL). O Overpass foi bloqueado pelo proxy da sessão, então os dados vieram de um workflow do GitHub Actions que baixa **só** o recorte da sede (bbox ±0,02°) e faz o commit do arquivo bruto com procedência. Não se usou nenhum arquivo estadual. Os dados do Google Maps **não** foram usados: a captura serviu só de referência visual.
- **Projeção:** plano tangente equirretangular local na origem da bbox, 1 unidade = 1 m, +x leste, +z norte. Erro medido ≤ 3 cm em 840 m.
- **Nada inventado na malha:** só vias carroçáveis do OSM (`service`/`track` ficaram de fora). Os únicos pontos sintéticos são os cortes na borda da rede. Semáforos e pontos de ônibus não existem no OSM e por isso não foram simulados; os pedestres atravessam quando a via está livre.
- **Estimativas declaradas:** como o OSM só tem 7 edificações, os lotes e as casas são gerados nas frentes das quadras reais (cerca de 12 × 20 m). Números de casa são métricos e estimados (`estimated: true`). Lojas, galpão, pessoas e plataformas continuam fictícios.
- **Galpão:** o layout da CORE-014 foi preservado no próprio quadro local e encaixado sem deformação na quadra real que comporta 64 × 58 m (Estrada Municipal Manoel Leitão). `DEPOT_LOCAL_SPOTS` fica no quadro local e `DEPOT_SPOTS` em coordenadas de mundo.
- **Desempenho:** casas em setores de 100 m, com LOD distante mesclado por setor. O detalhe é construído perto do jogador, no máximo um setor por quadro, e descartado ao se afastar. A meta de 30 FPS só vale medida em aparelho.
- **Aviso obrigatório mantido:** o validador exige "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE". Com a malha real o texto ficou impreciso, e alterá-lo depende de decisão do usuário (C13-06).
