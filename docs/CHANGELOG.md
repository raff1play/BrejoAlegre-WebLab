# Histórico de engenharia (não é registro de lançamento)

## 2026-11-11 — Preparação local inicial

- Código do starter reorganizado em `src/features`, `src/core`, `src/config`, `src/world`.
- Aproximação de colisão adicionada à moto/pedestre e testes unitários puros.
- Fluxos CI staging + Pages manual, sem publicação automática.
- Contratos de agentes, histórico de decisões, documentação de ambientes, gates e handoff adicionados.
- **NÃO houve push para GitHub:** integração recusou escritas (403). **NÃO houve build/browser real:** npm inacessível (EAI_AGAIN).

Próximas mudanças devem registrar PR/SHA e resultados verificáveis.

## 2026-11-11 — Integração GitHub restabelecida

- Branch `setup/weblab-foundation` criada via conector autorizado; 55 arquivos de texto publicados no commit `dc0a7219007d2528bd99e5eb11ede9e3688dc3bf`.
- PR #1 aberto como rascunho, sem merge ou deploy.
- O status antigo de 403 é histórico; compilação Vite e navegador ainda não foram testados.

## 2026-11-11 — CI GitHub concluída

- Run `43022020392` concluída com sucesso: npm install, verificação da estrutura, testes unitários e build de staging (inclui typecheck).
- Artefato de build arquivado; chunk JS principal ~7,2 MB (não otimizado para download mobile).
- Navegador e Android seguem sem validação real.

## 2026-11-11 — Publicação e auditoria remota (corrige o histórico acima)

- Incidente GitHub 403 corrigido; branch `setup/weblab-foundation` e PR #1 em rascunho criados, `main` preservada.
- A CI remota da HEAD `a4201daeb50399830a318a2428076072ad44f8e0` passou (run 43022470633): instalação, validação documental, 6 testes e build de staging com typecheck.
- Revisada a próxima tarefa do Fable para trabalhar na branch e PR existentes; fonte de verdade, riscos, estado e direção visual corrigidos.
- Não houve testes reais em navegador/Android, captura de gameplay, lockfile nem deploy.

## 2026-11-11 — Web Lab 0.1 jogável

- `c0795b9`: `package-lock.json` versionado; CI e Pages passam a usar `npm ci`.
- `37a7d31`: primeira versão jogável.
  - Simulação pura em `src/core/`: moto (aceleração progressiva, freio, ré lenta, direção limitada por aderência, inclinação visual), pedestre relativo à câmera, montar/desmontar, colisão com deslizamento e subpassos, altura de terreno, estado de entrada sem tecla presa.
  - Rua fictícia nova em `src/world/`: 10 casas com telhado/muro/portão, mercearia genérica com vagas de moto, praça, cruzamento com faixas e PARE, postes com fiação, árvores, cavaletes no fim da área e placas "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE".
  - Texturas procedurais (sem assets de terceiros), sol com sombra que acompanha o jogador, céu e névoa.
  - Câmera isométrica com giro, zoom, arrasto, pinça e fade de construções que escondem o jogador.
  - Controles de teclado e multitoque, HUD para paisagem, perfis gráficos desktop/mobile (`?gfx=mobile|desktop` ou botão no HUD).
  - Bundle principal 7,2 MB → 1,32 MB com imports específicos do Babylon.
- `f1615d9`: roteiro de navegador `tests/e2e/play.cjs` (44/44 no build de staging) e capturas reais em `docs/evidence/`.
- Correções de bugs encontrados ao executar: direção invertida do starter, texturas dinâmicas em modo clamp, ré disparando ao segurar o freio, HUD lendo o DOM antes do construtor.
- **Não feito:** teste em Android real, medição de FPS em aparelho, deploy no Pages, merge.

## 2026-11-11 — Botão para tentar iniciar em horizontal

- Implementado no overlay vertical o botão **Jogar na horizontal**.
- Clique do usuário solicita Fullscreen API e depois `ScreenOrientation.lock('landscape')`, com fallback explícito quando o navegador/SO recusa.
- Arquivos: `index.html`, `src/style.css`, `src/main.ts`, `src/features/display/landscape.ts`, `tests/landscape.test.ts`.
- Testes de sucesso, fullscreen já ativo, APIs ausentes e recusas de fullscreen/orientação acrescentados; CI da HEAD `1ffd0b8f394ee811d0a0cafd0075fcad61f5f69c` passou em push e PR.
- **Sem comprovação de bloqueio de orientação no Galaxy S24 real**; requer teste pelo usuário em Chrome Android. Não é rotação garantida nem automática sem interação.
- A publicação do preview da nova versão deve ser registrada com SHA e execução em `docs/PROJECT_STATE.md`.

## 2026-11-11 — PWA instalável (implementação para teste)

- Manifesto web: nome, identidade, `standalone`, preferência horizontal e ícones PNG originais 192/512.
- Botões **Instalar app** na tela vertical e no HUD, com `beforeinstallprompt` opcional e alternativa do menu Chrome.
- Em modo instalado, não solicitar fullscreen do navegador para orientar a tela. Opção manual preservada para o navegador comum.
- Service worker restrito ao escopo do GitHub Pages, rede primeiro e cache para fallback.
- Testes novos cobrindo manifesto, ícones, detecção de modo aplicativo, fallback e comportamento instalado sem fullscreen.
- Instalação/rotação reais no Android não verificadas até teste físico; páginas publicadas dependem do workflow de preview.

## 2026-11-11 — Retorno ao navegador e analógico real

- Pedido do usuário: desativar o PWA, continuar pelo Chrome e trocar setas por um joystick analógico eficiente.
- Removido link de manifesto, botões de instalar e `initializePwa()` da inicialização; serviço anterior substituído por worker de desativação e código que remove somente registration/caches do Web Lab. `public/manifest.webmanifest` e ícones históricos permanecem no repositório, mas não são anunciados na página.
- Joystick 2D com Pointer Events, captura por dedo, zona morta radial de 12%, alcance limitado, sinal contínuo [-1,1], reset ao soltar, cancelar ou perder foco.
- Na moto: joystick X controla apenas esterço; acelerar/frear à direita. A pé: joystick X/Y move em 360° e varia velocidade proporcionalmente. Teclado preservado.
- Atualizados testes unitários e roteiro `tests/e2e/play.cjs` para tocar no analógico, não nas setas removidas.
- **Ainda depende de CI para a HEAD final e de teste físico no Galaxy S24; não afirmar melhora ergonômica/FPS sem medir.**

## 2026-11-11 — Direção da moto mais leve (W008)

- Recalibrada a curva do analógico **somente na moto**: deslocamentos intermediários produzem mais esterço sem perder centro neutro.
- Resposta de direção mais rápida (`steerInRate` 3,2 → 5,0/s; `steerOutRate` 5,5 → 8,0/s), curvas mais fechadas em baixa velocidade (`maxSteerAngle` 0,56 → 0,67 rad) e aderência arcade levemente maior (`maxLateralAccel` 6,5 → 8,0 m/s²).
- Preservados velocidade máxima, teclas, pedestre, aceleração/freio, colisões, visual e navegador sem PWA.
- Testes incrementados para resposta parcial, simetria, ausência de NaN, moto parada sem girar e recentralização.
- Avaliação ergonômica e FPS no Galaxy S24 dependem de teste presencial; não confundir melhora esperada com resultado medido.


## 2026-11-12 — W009 qualidade visual

- `3ca7f57` — **Entrega A:** moto de entregas detalhada (rodas, garfo, motor aletado, escapamento, tanque, banco, amortecedores, guidão, espelhos, farol, setas, baú) e entregador articulado com IK (`src/core/ik.ts`, `src/features/shared/character.ts`); rodas, esterço, suspensão, pé no chão, caminhada e transições de montar/descer só visuais.
- `440f192` — **Entrega B:** vitrine de cinco fachadas (varandas, pedra canjiquinha, cobogó, venezianas, parabólica, canteiros, palmeiras, calçadas individuais) e detalhes leves na rua toda (cumeeiras, padrão de energia, sarjeta, bocas de lobo, sombras de contato).
- Skinning rígido na GPU (`src/features/shared/rigidSkin.ts`) devolve os draw calls ao nível da W008; triângulos ativos ≈ +85–90%.
- `src/features/shared/modelParts.ts` → `src/world/modelParts.ts`; materiais `chrome()`, `lacquer()`, luzes num material único; logs de `docs/evidence/` passam a ser versionados.
- Física, controles, câmera, colisões existentes e PWA desativado: sem alteração. Sem publicação no Pages. Android real não testado.

## 2026-11-12 — CORE-010 remasterização visual (branch `feat/core-010-visual-remaster`)

- `9348f2b` — luz de fim de tarde, céu com cúmulos, curvas de cor/vinheta, morros com casario, igreja e caixa-d'água ao fundo.
- `2c06011` — folhagem por cartões (oiti, ipês amarelo e roxo, arbustos, buganvílias), telhas mais quentes, fiada de beira, caibros, muros com pilares/capitel, rodapé de pedra, arandelas, placas de número, floreiras, postes coloniais, lixeiras, asfalto limpo e faixas de bordo; teste de layout novo.
- `6c2ffe8` — moto e baú amarelos com preto; colete amarelo do entregador.
- Nenhum asset externo (fontes bloqueadas pela rede). Física, controles, câmera e colisões preservados (44/44 no navegador).

## 2026-11-12 — CORE-011 assets 3D reais (branch `feat/core-011-real-assets`)

- `8b255ea` — poste, floreira, porta de enrolar e telha cerâmica do Poly Haven (CC0), otimizados (≈ 320 kB de modelos + 156 kB de textura).
- `53494ed` — carregamento glTF sob demanda com fallback procedural, conversão para StandardMaterial, instancing, telha fotográfica em todos os telhados, testes dos arquivos/manifesto/posições.
- Física, controles, câmera, colisões e melhorias da CORE-010 preservados (44/44 no navegador, 51/51 unitários).

## 2026-11-12 — CORE-012 câmera GTA (branch `feat/core-012-gta-camera`)

- Câmara reversível isométrica/terceira pessoa com botão GTA/ISO, tecla C, suavização de rumo, giro livre e proteção de câmera contra prédios, muros, postes e árvores.
- Moto, caminhada, analógico e os assets Poly Haven da CORE-011 foram preservados.
- Novos testes unitários da matemática de câmera; roteiro de navegador ampliado para testar alternância desktop e touch (execução E2E real ainda pendente).
- CI confirma TypeScript/build e testes unitários; Chrome Android e FPS não medidos. Nenhum deploy/merge.

## 2026-11-13 — CORE-013 expansão e cidade viva (branch `preview`)

- `392142d` — cidade em grade 3×3 ao redor do núcleo W009 (Centro, residencial, comercial, logístico, periferia), 8 lojas configuradas, galpão logístico com pátio/docas/portão, igreja, escola, centro de serviços, pontos de ônibus, lombadas, árvores, postes, saídas rurais; `docs/CITY_REFERENCE.md`.
- `418390f` — portão/pátio do galpão na rede; relógio virtual (1 h = 4 min, jornada 11h–21h) e iluminação dia/noite puros.
- `92b5e16` — rede de faixas, conversões e conflitos; semáforos com fases exclusivas, amarelo, vermelho geral e fase de pedestre; veículos IDM com PARE, preferência, rotas de ônibus/vans/caminhões.
- commit seguinte — pedestres (grafo de calçadas, travessia em faixas, lojas, praça, ônibus).
- commit seguinte — renderização instanciada de veículos/pedestres/semáforos, luz por hora (sol, céu, névoa, sombras, poças de luz dos postes, faróis), minimapa e relógio no HUD, controle de hora de desenvolvimento, testes.

## 2026-11-13 — CORE-014 simulador de entregas (branch `preview`)

- `5c0e8bb` — cidade com 2,15× a área navegável (novos bairros fictícios), 48 endereços entregáveis, domínio de entregas puro (endereços, volumes, lojas, galpão, jornada) e testes.
- `a66e79a` — câmera única em terceira pessoa (GTA/ISO removido), HUD mínimo com Pausa/Sobre, lojas ocas com vitrine, porta de enrolar, balcão e estoque, galpão com interior e operação, funcionários e clientes articulados, veículos NPC com silhueta real, placas de número, jornada jogável.
- commit seguinte — correção de shader (instâncias com cor), câmera em interiores, teste de navegador da jornada completa, auditoria visual e documentação.

## CORE-015 — Brejo Alegre real 1:1 (13/11/2026, branch `preview`)

- Revertido seletivamente o piloto Patch.gg (`1ddbd18`), com histórico preservado e Poly Haven mantido.
- Recorte OpenStreetMap da sede baixado por workflow isolado (`.github/workflows/osm-fetch.yml`) e versionado com procedência e licença ODbL (`data/osm/`).
- Importador OSM → `src/world/geo/brejoAlegreData.ts`, com projeção métrica local (1 unidade = 1 m) e fonte única para ruas, quadras, lotes, tráfego, pedestres, minimapa e entregas.
- Rede viária, quadras e lotes gerados da geometria real.
- Colisão por polígonos com índice espacial; câmera com caixas orientadas; lotes e fachadas em qualquer ângulo.
- Casas por setor com LOD.
- Galpão CORE-014 encaixado rigidamente numa quadra real; lojas em quadras do centro.
- Tráfego com sentido único e admissão encadeada; sem semáforos nem pontos de ônibus (não mapeados no OSM).
- Comparação cartográfica verificável (`scripts/geo/compare-map.ts`, `scripts/geo/compare-shots.cjs`, `docs/evidence/core015-mapa/`).
- Atribuição OSM/ODbL na tela Pausa/Sobre.

## CORE-015.1 — Correções e baú (14/11/2026, branch `preview`)

- Geometria: quadras por Douglas–Peucker com tampa nas ruas sem saída; casas na medida do lote; muros recortados perto de vias; asfalto com UV de mundo; calçada alinhada à rua.
- Colisões: deslize em qualquer ângulo; mobiliário urbano sólido; planta única das lojas; portas das lojas.
- Lojas: interiores por categoria, balcão, placa e marcação de retirada.
- Encomendas físicas com o baú da moto (mãos, baú, galpão, saca, destinatário).
- HUD e minimapa novos; rota pelas ruas; ajustes pequenos de esterço, acelerador e freio.

## 14/11/2026 — Street Preview isolada

- Faixas zebrada na tangente/normal local; testes de orientação e curva.
- Removida face indevida do barrado que atravessava a entrada das lojas; acabamentos e encontros de muros contidos nos limites disponíveis.
- Jardineira identificada e alinhada à fachada/colisor; quaternion herdado não bloqueia mais a rotação das instâncias GLB.
- Evidências reais antes/depois em `docs/evidence/street-fixes/`; somente branch experimental, sem integração à CORE-015.1.

## GFX-001 — Remaster visual e cidade viva (15/11/2026, branch `feat/gfx-001-visual-lab`)

- A: céu, luz, névoa, morros, relevo, marcação viária amarela, paleta dos muros.
- B: fachadas e interiores das oito lojas; sinalização e triagem do galpão.
- C: luzes da moto, carga no baú, mistura de poses, rota dos funcionários.
- D: comportamento de veículos e pedestres.
- E: capturas antes/depois e métricas (`scripts/gfx/`, `docs/evidence/gfx-001/`).

## ART-001 — 14/11/2026 (branch isolada, sem publicação)

- Arte concentrada no Depósito de Construção, primeira coleta da seed padrão: nova platibanda, letreiro pintado, toldo, esquadrias, cerâmica, desgaste localizado, instalação elétrica e calçada imediata.
- Moto do jogador com rodas raiadas, tanque e carenagem revistos, banco nervurado, farol redondo e baú maior com identidade original de entregas. Física e regras preservadas.
- Capturas reais antes/depois e dados de complexidade em `docs/evidence/art-001/`; referência visual ainda não alcançada, Android real pendente.

## ART-002 — 14/11/2026 (continuação na branch ART-001, sem publicação)

- Reconstruídos portaria, perímetro, portões deslizantes com colisão dinâmica, pátio, vagas e docas no terreno existente; planta única para sólidos/renderização/navegação.
- Logística física por ID: recebimento, conferência, transferência com funcionário, esteira, gaiola regional e expedição na doca 02. Caminhão da doca 05 entra no mesmo fluxo; eliminadas caixas e rotas decorativas.
- Descarga exige vaga válida, parada, jogador a pé e viagens conforme a capacidade das mãos. A saca única contém os mesmos volumes, sem substituição de IDs.
- Atlas de etiquetas, instâncias de volumes, sincronização de custódia e apresentação; loja e moto ART-001 sem alterações. Evidências, planta e limites em `docs/evidence/art-002/README.md`.
