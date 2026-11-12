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

## 2026-11-11 — Dragão e fogos opcionais (W010, experimento)

- Incluído `?dragon=1` para carregar sob demanda uma cena curta de dragão 3D, baforada de fogo, foguete saindo do escapamento e texto “Marcos Pato” formado por pontos brilhantes no céu.
- Gatilho determinístico de **45 km/h de velocidade positiva**, uma vez por carregamento; duração ≈ 11,5 s e descarte das malhas, partículas, texturas e materiais após o evento.
- Padrão `?dragon=0` ou URL sem parâmetro mantém o Web Lab anterior sem carregar os gráficos extras; física e controles inalterados.
- Sem pacotes externos, PWA, persistência ou alterações no jogo definitivo.
- Testes unitários cobrem opção ativada/desativada, limiar de velocidade, fases e import dinâmico. Teste físico de desempenho/visual no Galaxy S24 pendente.

## 2026-11-11 — Upgrade do dragão e áudio (W011)

- Som exclusivo da opção `?dragon=1`: motor sintético variável, rugido, sopro, foguete, fogos e dois grasnados "quack" gerados com Web Audio, acionados por gesto humano; botão "Ativar som" / "Som desligado" criado apenas no modo experimental.
- Dragão procedural original mais ameaçador (textura de escamas, olhos, mandíbula, dentes, garras, chifres, cauda, asas nervuradas), geometrias estáticas fundidas por material.
- Baforada reforçada com núcleo de fogo, chama, fumaça e luz dinâmica, sem dano/colisões.
- Não importados assets externos de autoria/reutilização ainda não confirmadas; o limite entre modelo procedural aprimorado e dragão cinematográfico permanece documentado.
- Nenhum arquivo de lógica de pilotagem, câmera, cenário, HUD, CSS principal, PWA ou economia alterado.
