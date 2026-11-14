# Experimento isolado — Ruas e sinalização (CORE-015.2 candidata)

**Situação:** branch experimental, **NÃO incorporada à CORE-015.1**; `preview`/`main` não são alteradas por este experimento.

## Como comparar

- Jogo estável CORE-015.1: https://raff1play.github.io/BrejoAlegre-WebLab/
- Experimento isolado: https://raff1play.github.io/BrejoAlegre-WebLab/street-preview/
- A publicação do experimento combina uma compilação da CORE-015.1 **fixada no commit `d6eabc4909551001c3203aa4314d8c1c852ac304`** na raiz com a compilação experimental somente no subdiretório. O Pages é um único serviço, mas os aplicativos carregados são de commits diferentes. Nenhum merge com `preview` ou `main`.

## Mudanças

- Textura do asfalto refinada, com granulado e variações discretas; linhas de centro residenciais e pintura branca nas aproximações.
- Faixas de pedestres em cruzamentos urbanos espaçosos, alinhadas aos caminhos do grafo pedonal e aos eixos de vias OpenStreetMap.
- Linhas de parada nas aproximações com PARE e semáforos.
- Calçadas com juntas de dilatação discretas e sarjeta no limite do meio-fio.
- Postes com pedestal e luminária detalhados, reaproveitando as mesmas posições e luz noturna já existentes.
- Semáforos ativados **somente como mobiliário e controle FICTÍCIOS do jogo**, em um pequeno subconjunto de cruzamentos adequados, com máquina de fases veicular/pedonal existente. O OSM **não comprova semáforos reais em Brejo Alegre**. Correção da posição dos sinais: as cabeças ficam no término da aproximação, não na origem da rua.
- Etiqueta visível "EXPERIMENTO · RUAS E SINALIZAÇÃO".

## Critérios antes de integrar à CORE-015.1

- Comparação visual em navegador desktop e no Galaxy S24 real.
- Verificação das faixas nas esquinas, nenhuma invasão de lote e nenhuma duplicação/flicker de calçadas.
- Verificar tráfego e pedestres obedecendo às fases dos semáforos, sem congestionamento/travamento e respeitando PARE onde não há sinal.
- Medir FPS e temperatura no Android e ajustar densidade de marcas/iluminação se necessário.
- Validar colisão e visibilidade de postes/sinais.
- Revisão do usuário e autorização **explícita** antes de qualquer incorporação à branch `preview`.

## Testes

`npm run check` + `tests/urbanDetail.test.ts`; GitHub Actions do experimento confere a base e a versão experimental antes de publicar. E2E visual e performance em telefone real continuam pendentes até medição.
