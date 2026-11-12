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

## W010 — Riscos do teste do dragão

- **B032 — PENDENTE:** verificar no Galaxy S24 se o dragão e a palavra “Marcos Pato” aparecem dentro do enquadramento na câmera isométrica, especialmente em diferentes zooms.
- **B033 — PENDENTE:** conferir FPS durante 11,5 s do evento; partículas, geometria e textura dinâmica são carregadas apenas com `?dragon=1`.
- **B034 — PENDENTE:** validar eliminação completa de malhas/partículas/texturas após o evento, sem acúmulo, e que a URL sem parâmetro se comporte como a W009.
- **B035 — PENDENTE:** checar legibilidade das letras no céu e sincronização do foguete com o escapamento em curva ou movimento, após publicação de preview.
