# ART-001 — primeira coleta e moto

Branch: `feat/art-001-primeira-loja-moto`. Base: GFX-001 `e15c8d216a0b321bc620deff8b368420cd6a399e`.
O workflow `street-preview.yml` na branch de publicação `feat/core-015-2-urban-roads-preview` fixa esse SHA para `/gfx-preview/`. Nenhum gatilho de publicação foi alterado. A API GitHub retornou Forbidden nesta sessão; a base foi identificada pelo workflow e pelos refs obtidos com Git, sem afirmar uma nova consulta bem-sucedida ao histórico de deploys.

## Loja correta

`Workday.start()` embaralha as lojas com seed padrão **2026**. No jogo em execução, `delivery.assigned` é `["construcao", "farmacia"]` e o objetivo inicial é **Coletar em Depósito de Construção**. A arte está restrita a `construcao`. Não mudamos a seed nem a sequência para justificar a escolha. Seeds alternativas podem começar em outra loja.

## Arte entregue

- Loja: platibanda com cornija, letreiro original pintado em canvas, paleta ocre/verde petróleo, desgaste do letreiro, reboco com cicatrizes e tijolos aparentes nos pilares, toldo em painéis metálicos com juntas oxidadas, cerâmica rejuntada e esquadrias com venezianas laterais, cartaz de cimento.
- Área imediata: soleira, remendos, bordas cerâmicas na calçada, guia reparada, grelha de drenagem, mastro de entrada elétrica com isoladores e cabos curvos, medidor, conduíte, luminária e vaso. Sacos de cimento sobre pallet dentro do volume sólido existente.
- Interior: paleta coerente, nova identificação de retirada acima do estoque; mobiliário e balcão funcionais da base preservados. Não é um interior novo completo.
- Moto do jogador: tanque mais cheio, tampas laterais recortadas, banco marrom com nervuras, rodas raiadas, pneus mais largos, sanfonas do garfo, farol redondo com viseira, cabos do guidão, proteção do motor, escudo do escapamento e baú maior com cantoneiras e identidade fictícia BREJO ENTREGAS. Tampa articulada e carga continuam funcionais. A seleção visual fica restrita ao `PLAYER_LOOK`.

Nenhum asset externo nem dependência nova. Geometria real e arte original criadas no código; o letreiro não é uma imagem de IA. Não foi reformada outra loja, galpão, cidade ou IA. Nenhuma mudança nas regras de física/coleta, nos colisores ou no controlador da câmera. Os detalhes sólidos no chão usam paredes e o volume de exposição já colidível; a circulação central permanece livre.

## Capturas reais e reprodução

| Enquadramento | Antes | Depois |
|---|---|---|
| Loja | [before/shop.jpg](before/shop.jpg) | [after/shop.jpg](after/shop.jpg) |
| Rua imediata | [before/street.jpg](before/street.jpg) | [after/street.jpg](after/street.jpg) |
| Moto | [before/bike.jpg](before/bike.jpg) | [after/bike.jpg](after/bike.jpg) |
| Interior | [before/interior.jpg](before/interior.jpg) | [after/interior.jpg](after/interior.jpg) |

Capturados com `scripts/art/capture.cjs` no jogo em execução, Chromium headless, **1280×720**, perfil alto, tráfego desligado nos dois lados. O script usa a câmera de inspeção do jogo (desativa céu/névoa), com poses idênticas registradas nos JSONs; mantém a iluminação da cena. Hora inicial 12h30; a simulação continua durante cada série. Antes capturado na base intacta, depois na implementação ART. Sem retoque de screenshot.

```sh
npm ci --cache /tmp/art-npm --no-audit --no-fund
npm run dev -- --port 5173
# outro terminal, na base e depois na ART:
node scripts/art/capture.cjs docs/evidence/art-001/before
node scripts/art/capture.cjs docs/evidence/art-001/after
```

Playwright é ferramenta do ambiente, não dependência do projeto. `CHROMIUM_PATH` e `WEBLAB_URL` permitem ajustar navegador e servidor. Dados brutos: `before/metrics.json` e `after/metrics.json`, 30 quadros renderizados por enquadramento.

## Avaliação e limites

A mudança de identidade da fachada é clara: desenho, proporções do letreiro, toldo, esquadrias e piso foram alterados juntos. A moto ganha rodas, corpo e caixa com leitura utilitária mais definida. **Ainda não alcança a qualidade da referência descrita**: materiais e volumes continuam simplificados, superfícies grandes ainda parecem uniformes, o desgaste não tem a riqueza de um asset pintado profissionalmente e o interior recebeu melhoria modesta. A imagem exata de referência não foi anexada nesta tarefa nem está versionada; a comparação é com os atributos textuais solicitados, sem fingir análise lado a lado dela.

Não testado em Android físico, nem em Chrome com GPU física. Draw calls e triângulos descrevem o custo da cena; tempos do SwiftShader variam com a carga da máquina e não são uma previsão de FPS do Galaxy S24. A nova arte precisa de avaliação humana na câmera de gameplay e no aparelho. Não há publicação, merge ou aceite visual presumido.

## Verificação executada

- `npm ci --cache /tmp/art-npm --no-audit --no-fund`: concluído. A tentativa inicial com cache padrão falhou por acesso ao cache do diretório pessoal; o cache temporário resolveu sem mudar dependências.
- `npm run check`: validação do repositório passou, **104/104 testes unitários**, TypeScript strict e build de staging concluídos. Log: [check.txt](check.txt). O Vite mantém aviso de bundle acima de 1.500 kB.
- Roteiro completo existente no navegador com adaptador de resolução reduzida: **83/84**. Log integral [gameplay.txt](gameplay.txt). Passaram direção, frenagem, giro/inclinação, câmera, montar/desmontar, caminhada, colisão com muro/casa/moto estacionada, coleta inicial, abertura/armazenamento do baú, jornada e controles touch emulados. Sem erros de console nos três percursos.
- A única falha foi `redimensiona o canvas com a janela`: o adaptador `docs/evidence/street-fixes/runner-low-resolution.cjs` força escala de hardware 4, então o render fica **225×105** para viewport **900×420**, enquanto a asserção original espera 900×420. Não alterar o teste para esconder isso. Verificação separada sem o adaptador, `node scripts/art/resize.cjs`: **PASS 900×420**, log [resize-native.txt](resize-native.txt).
- As capturas de arte usam resolução real 1280×720 e **não** usam o adaptador reduzido do E2E. Após revisão das faces dos painéis/etiquetas da moto pelos dois lados, build de staging repetido e capturas finais renovadas; o ajuste final é somente de orientação de faces.

Comandos do navegador:

```sh
WEBLAB_SHOTS=docs/evidence/art-001/e2e node docs/evidence/street-fixes/runner-low-resolution.cjs
node scripts/art/resize.cjs
node scripts/art/report.cjs
```

## Arquivos e commits

- `a40a07d`: `src/world/city/firstPickupArt.ts`, `src/world/city/storeFacade.ts`, `src/world/city/cityBuild.ts` — fachada específica e integração local.
- `be5b96d`: `src/features/driving/motorcycle.ts` — apresentação da moto do jogador; nenhum arquivo de simulação alterado.
- Commit de evidências/documentação: `scripts/art/{capture,report,resize}.cjs`, esta pasta (capturas, comparador HTML, métricas e logs), `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`, `docs/ISSUES_AND_RISKS.md`, `docs/ASSETS_AND_LICENSES.md`.

Sem PR, merge, publicação ou alteração de workflow/arquivo de gatilho. Próximo passo: revisão humana das comparações e teste físico no aparelho; ampliar qualidade apenas nesses dois objetos caso a direção seja aprovada.
