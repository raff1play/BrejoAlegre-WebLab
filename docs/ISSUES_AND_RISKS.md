# Pendências, riscos e decisões em aberto

| ID | Prioridade | Status | Ação / decisão |
|---|---|---|---|
| B001 | Alta | RESOLVIDO em 11/11/2026 | Integração GitHub voltou a criar branch/arquivos; verificar PR #1. Não realizar push manual duplicado. |
| B002 | Média | RESOLVIDO em 11/11/2026 (`c0795b9`) | `package-lock.json` versionado; `ci.yml` e `pages.yml` usam `npm ci` com cache npm. |
| B003 | Alta | RESOLVIDO PARCIALMENTE em 11/11/2026 | Jogo testado em Chromium headless (44/44 verificações, `docs/evidence/`). Falta Chrome desktop com GPU real e avaliação humana da dirigibilidade. |
| B004 | Alta | **NÃO TESTADO** | Chrome Android real, FPS, termal, toque com dedos. Só houve emulação de toque/viewport. Checklist em `docs/NEXT_TASK_FOR_FABLE.md`. |
| B005 | Média | PARCIAL | Rua 0.1 com texturas procedurais, sombras e proporções plausíveis, mas ainda em primitivas. Modelos licenciados (moto, piloto, vegetação) continuam necessários para a meta semirrealista. |
| B006 | Média | PROVISÓRIO | Moto é modelo cinemático (bicicleta + limite de aderência) com dois círculos de colisão contra caixas alinhadas aos eixos. Sem suspensão, derrapagem ou queda. Meio-fio é só degrau visual suavizado. |
| B007 | Média | PENDENTE | Geografia, setorização real de Brejo Alegre e rotas; não implementar sem verificação de fonte/licença. |
| B008 | Média | PENDENTE | Regras futuras de saída antecipada, custo de manutenção, preço de veículos, bônus de equipe. Nenhuma aprovada além do mestre. |
| B009 | Média | PENDENTE | Proteções de branch e Pages não estão habilitadas só por existirem arquivos YAML. Requer configuração explícita. |
| B010 | Média | PARCIAL | Perfis desktop/mobile existem (resolução, sombra, anisotropia, texturas, árvores de fundo), porém os valores são estimativas: calibrar com FPS medido em aparelho. |

| B011 | Média | ABERTO | `tests/e2e/play.cjs` depende de Playwright/Chromium do ambiente e não roda na CI. Decidir se vale adicionar a dependência e o download do navegador à CI. |
| B012 | Baixa | ABERTO | Deslizamento contra obstáculos é por eixo: o pedestre pode "grudar" ao andar de frente contra a moto ou um tronco, precisando contornar. |
| B013 | Baixa | ABERTO | Fade de oclusão cobre casas e loja; copas de árvores e muros não ficam translúcidos. |
| B014 | Baixa | ABERTO | A simulação limita o passo a 50 ms: abaixo de 20 FPS o jogo fica em câmera lenta (escolha deliberada para evitar teleporte). |
| B015 | Baixa | ABERTO | Sem áudio, sem tela de carregamento e sem tutorial; a primeira pintura das texturas ocorre de forma síncrona na inicialização (tempo em celular não medido). |

Não marcar bloqueio como corrigido sem evidência de execução, timestamp e, quando aplicável, SHA/PR.

- **R-PERF-001 (mitigado, não encerrado):** bundle principal caiu de ~7,2 MB para **1,32 MB (≈ 324 kB gzip)** com imports específicos do Babylon. Tempo de carregamento e FPS em Chrome Android seguem **não medidos**.
- **R-PERF-002 (aberto):** ≈ 160 draw calls/quadro com sombras em tempo real. Deve caber num aparelho intermediário, mas isso é hipótese até medir. Se faltar FPS: reduzir `maxPixelRatio`, baixar `shadowMapSize`/`shadowRange` ou tornar a sombra do cenário estática.
- **R-TEST-001 (aberto):** o Chromium headless usa GPU por software (4–9 FPS). Os testes de navegador provam comportamento, não desempenho.

- **R-VISUAL-002 (aberto):** as imagens conceituais anteriores não foram incluídas no GitHub; referência textual em `docs/VISUAL_DIRECTION.md`. Não fingir que o agente viu imagens não versionadas.

## Pendências PWA — 11/11/2026

- **B016 — TESTE PENDENTE:** instalar o app no Galaxy S24 via Chrome, abrir pelo ícone e confirmar se abre sem aviso cinza de fullscreen.
- **B017 — TESTE PENDENTE:** confirmar se o Android respeita `orientation: landscape` com rotação automática ligada/desligada; o manifesto não garante o resultado.
- **B018 — TESTE PENDENTE:** validar retomada do aplicativo, atualização de versão e fallback offline do service worker sem cache desatualizado.
- **B019 — LIMITE DE SUPORTE:** o evento `beforeinstallprompt` não é universal; oferecer instruções de menu nativo do navegador quando indisponível.

## Pendências após W007 — navegador e analógico

- **B016–B019 (SUBSTITUÍDAS por W007):** a experiência PWA foi cancelada para o Web Lab; os testes de instalação não são mais critérios de aceite desta versão.
- **B020 (TESTE PENDENTE):** testar no Galaxy S24 se joystick responde proporcionalmente, se há desvio involuntário e se two-thumb (joystick + acelerar/frear) funciona sem lag.
- **B021 (TESTE PENDENTE):** verificar reset de `pointercancel`, `lostpointercapture`, bloqueio/troca de aba e posição dos botões em diferentes orientações.
- **B022 (TESTE PENDENTE):** confirmar que instalação PWA anterior foi desregistrada e seu cache exclusivo foi removido após carregar a nova página. O ícone já instalado no Android deve ser removido manualmente pelo usuário.
- **B023 (LIMITAÇÃO):** roteiro Playwright do navegador foi atualizado para o joystick, mas não é executado pela CI padrão; testes unitários/build não equivalem a ergonomia real.

## W008 — Validação da dirigibilidade leve

- **B024 — PENDENTE:** confirmar em Galaxy S24 a suavidade do primeiro quarto do analógico, curvas de esquina a 10–25 km/h, retorno do guidão após soltar o dedo e capacidade de fazer retorno em espaço limitado.
- **B025 — PENDENTE:** comparar curvas antes/depois, repetindo o mesmo trecho, para identificar exagero de sensibilidade ou colisões não previstas após aumentar o esterço/aderência.
- **B026 — PENDENTE:** monitorar FPS durante manobras e não atribuir à calibração física variações de hardware sem medir.


## W009 — Qualidade visual

- **B027 — PENDENTE:** avaliação no Galaxy S24 da nova moto, do entregador e da vitrine (aparência, legibilidade em tela pequena, FPS nos perfis leve/alto após 3–5 min, aquecimento).
- **R-PERF-003 (aberto):** triângulos ativos subiram de ≈ 42 mil para ≈ 78–81 mil (perfil alto) e de ≈ 38 mil para ≈ 70–72 mil (leve), contando o passe de sombra. Draw calls ficaram no nível da W008. Se o aparelho perder FPS: reduzir detalhes da moto decorativa, tirar sombra da moto decorativa e dos arbustos no perfil leve, baixar segmentos de esferas/toros, ou limitar a vitrine ao perfil alto.
- **R-GPU-001 (aberto):** moto e entregador usam skinning na GPU (até ~16 ossos, 1 influência por vértice). Comum em WebGL2, mas **não verificado** em Chrome Android real.
- **B028 — LIMITAÇÃO:** as animações são reações visuais ao estado da simulação (suspensão, IK, transições de 0,4 s); não existem colisões para membros, e a perna pode atravessar o banco durante a transição de montar.
- **B029 — LIMITAÇÃO:** só cinco fachadas receberam o tratamento completo; as demais casas ganharam apenas cumeeiras, molduras, padrão de energia e sombras de contato.
- **B030 — RESOLVIDO no roteiro:** a verificação de colisão lateral do `tests/e2e/play.cjs` falhava quando a curva terminava diante de uma árvore/poste da calçada; agora aceita esses sólidos e registra `z`.
- **B031 — CORRIGIDO:** logs de `docs/evidence/` eram ignorados pelo `*.log` do `.gitignore`, então o log da 0.1 citado no estado nunca foi versionado; exceção adicionada.

## CORE-010 — Remasterização visual

- **B032 — BLOQUEADO (ambiente):** patch.gg, kenney.nl, quaternius.com, polyhaven.com (+api/dl) e ambientcg.com recusados pelo proxy (403). Para usar assets externos numa próxima etapa, liberar esses hosts na rede do ambiente; registrar licença de cada asset em `public/assets/ASSET_MANIFEST.md`.
- **B033 — PENDENTE:** avaliação no Galaxy S24 da nova luz, da folhagem alfa (custo de *overdraw* e recorte de alfa na GPU móvel) e do FPS nos perfis leve/alto.
- **R-PERF-004 (aberto):** na vitrine, W009 → CORE-010: draw calls 183 → 199 (+9%) e triângulos ≈ 78 mil → ≈ 92 mil (+18%) no perfil alto; 180 → 193 e ≈ 70 mil → ≈ 85 mil no leve (medido antes de tirar as floreiras das sombras do perfil leve). Folhagem alfa pode pesar em *fill rate* no celular; mitigação: reduzir `count` dos cartões ou usar só o núcleo no perfil leve.
- **B034 — LIMITAÇÃO:** o fundo (morros/casario) só aparece com a câmera na inclinação máxima; os limites da câmera não foram alterados.
- **B035 — PENDENTE:** a referência inclui comércio com letreiros, NPCs e carros — fora desta etapa. Próxima área sugerida: mercearia e cruzamento.

## CORE-011 — Assets externos

- **B036 — BLOQUEIO PARCIAL (rede):** recusados pelo proxy: `assets.patchusercontent.com` (arquivos do patch.gg), `acg-download.struffelproductions.com` (downloads do ambientCG), `drive.google.com` e `drive.usercontent.google.com` (pacotes da Quaternius). `kenney.nl` passa pelo proxy mas o site responde 403 a clientes automatizados. Funcionam: `patch.gg` (busca), `api.polyhaven.com`, `dl.polyhaven.org`, `ambientcg.com` (só API).
- **R-PERF-005 (aberto):** vitrine, CORE-010 → CORE-011 (headless): perfil alto 199 → 205 draw calls e ≈ 92 → 112 mil triângulos; perfil leve 193 → 195 e ≈ 85 → 93 mil. Download total ao abrir: 1,5 → 2,5 MB (≈ 415 kB de JS do loader glTF/PBR sob demanda + 309 kB de modelos + 72 kB de textura), depois que o jogo já está jogável. Memória de GPU: ≈ 1,4 MB por textura 512 px (≈ 13 texturas novas, ≈ 18 MB com mipmaps no pior caso).
- **B037 — ESTILO:** a floreira do Poly Haven é de madeira escura; as referências mostram floreiras claras de concreto. Mantida por ser o melhor candidato leve disponível; trocar se surgir um modelo claro CC0.
- **B038 — PENDENTE:** validar no Galaxy S24 os modelos externos, a telha fotográfica, o tempo de carregamento em rede móvel e o FPS.

## CORE-012 — Câmera terceira pessoa

- **B039 — PENDENTE:** validar no Galaxy S24 a alternância GTA/ISO, estabilidade do horizonte, giro com dedo, joystick e aceleração simultâneos, montagem/desmontagem, colisão visual perto de muro e FPS nos perfis leve/alto.
- **R-CAM-001 (aberto):** volumes simplificados evitam atravessar casas, muros, troncos e postes, mas vegetação volumosa, fios, grades e detalhes não entram em todos os volumes; podem obstruir a vista próxima. Validar no aparelho e refinar apenas onde necessário.
- **R-CAM-002 (aberto):** câmera terceira pessoa amplia a área vista e muda enquadramento de sombras/texturas; não há métrica confiável de FPS Android. Não inferir desempenho a partir de CI headless.

## CORE-013 — Cidade viva

| ID | Prioridade | Status | Ação / decisão |
|---|---|---|---|
| C13-01 | Alta | **NÃO MEDIDO** | FPS/termal no Galaxy S24 com tráfego e pedestres. Perfil leve: 16 veículos + logística, 26 pedestres, sombras só de ônibus/caminhões. Ajustar após medição. |
| C13-02 | Média | ABERTO | Traçado real de Brejo Alegre não verificado (OSM/IBGE bloqueados pela rede). Tudo é releitura; ver `docs/CITY_REFERENCE.md`. |
| C13-03 | Média | ABERTO | Ciclo fixo de semáforo ~62 s (4 aproximações exclusivas + pedestre): esperas de até ~50 s no vermelho. Ajustar tempos após teste humano. |
| C13-04 | Baixa | ABERTO | Pedestres atravessam postes/abrigos de ônibus em raros trechos (sem colisão física entre NPCs e mobiliário); veículos não desviam lateralmente, só freiam. |
| C13-05 | Baixa | ABERTO | Janelas não acendem à noite; iluminação noturna é aproximada (luz ambiente azulada + poças aditivas sob os postes + feixes dos faróis). |
| C13-06 | Baixa | DECISÃO PENDENTE | O aviso "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE" foi mantido (regra do validador). Se o usuário quiser um texto de "releitura fictícia", alterar HUD, placas 3D e validador juntos. |

- **C13-07 — CORRIGIDO NO CÓDIGO, PENDENTE NO APARELHO:** a CORE-013 inicialmente não adicionava os novos prédios/galpão/postes aos obstáculos de câmera GTA; corrigido adicionando os volumes estáticos em `src/world/cameraObstacles.ts`, com regressão unitária. Validar em Chrome Android, principalmente câmera muito próxima de muros e galpão.
## CORE-014 — Simulador de entregas

| ID | Prioridade | Status | Ação / decisão |
|---|---|---|---|
| C14-01 | Alta | **NÃO MEDIDO** | FPS/termal no Galaxy S24 com personagens articulados (até 10 transeuntes perto + 8 funcionários de loja + 8 do galpão). Perfil leve limita a 5 transeuntes articulados e sem sombras deles. |
| C14-02 | Alta | AVALIAÇÃO HUMANA | Aprovação estética das lojas, galpão, veículos e pessoas frente à CORE-012 (`docs/VISUAL_AUDIT_CORE014.md`). |
| C14-03 | Média | ABERTO | Modelos externos (Kenney/Quaternius/Poly Haven) não foram buscados nesta sessão; tudo é procedural. Se houver veículos/pessoas com licença verificada, substituir. |
| C14-04 | Média | ABERTO | Interior das lojas: piso sem textura e produtos como volumes coloridos; laterais externas simples. A mercearia W009 atende na porta (sem interior). |
| C14-05 | Média | ABERTO | Clientes andam em linha reta dentro da loja (sem colisão com o balcão); fila limitada a 4. |
| C14-06 | Baixa | ABERTO | Controle de hora de desenvolvimento pode levar a jornada a "ENCERRADA" ao pular para depois das 21h (só em dev). |
| C14-07 | Baixa | ABERTO | Volumes não aparecem fisicamente no baú/saca da moto; só nas mãos do entregador a pé. |

- **PATCH-01 — PENDENTE:** comparar estética do GLB City Bus (2008 triângulos, low-poly) com o ônibus procedural CORE-014; pode não elevar o realismo. Piloto permanece opt-in, reversível.
- **PATCH-02 — PENDENTE:** personagem anymove 6,27 MB/4K não pode ser replicada em dezenas de NPCs sem LOD e redução de textura. Testar animação no Babylon, escala, orientação e impacto no Galaxy S24.
- **PATCH-03 — PENDENTE:** validar telas e desempenho reais no Chrome Android; registros de CI e checks do GLB não equivalem à renderização móvel.
