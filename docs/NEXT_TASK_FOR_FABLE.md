# Próxima tarefa — validar no Galaxy S24 a direção recalibrada da moto (W008)

**Fonte da verdade:** `AGENTS.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md`.

## Estado aprovado

O Web Lab é um protótipo **single-player no navegador**. A instalação PWA foi suspensa por W007; NÃO oferecer botões/manifesto/service worker novo sem pedido explícito.

Controles móveis:
- Analógico inferior esquerdo: **direção da moto recalibrada em W008** — curva responsiva para pequeno/médio movimento do polegar; guidão reage mais rápido e curva mais fechado em baixa/média velocidade. A pé: 360° e velocidade proporcional (W007), sem alteração.
- Na moto, acelerar e frear permanecem à direita.
- Descer/Montar, câmera/zoom e teclas desktop permanecem. Zona morta radial de 12% e reset após `pointerup`, `pointercancel`, perda de foco e mudança de personagem.

Os arquivos de código da funcionalidade estão em `src/core/analogStick.ts`, `src/features/controls/virtualJoystick.ts`, `src/features/controls/input.ts`, `src/main.ts`; limpeza de PWA antigo em `src/features/display/disablePwa.ts`.

## Próximo teste humano

No Galaxy S24, abrir https://raff1play.github.io/BrejoAlegre-WebLab/ no Chrome em paisagem depois da última publicação do Pages.

1. As setas antigas desapareceram? O analógico aparece embaixo, à esquerda, e não tampa o personagem?
2. Acelerar segurando o botão direito e inclinar o analógico levemente; verificar se a moto esterça com facilidade sem puxões. Comparar meio percurso com percurso completo; testar retornos e curvas em baixa/média velocidade.
3. Soltar o analógico centraliza a esfera e zera rapidamente o esterço; não há comando preso nem correção excessiva após interromper toque ou trocar de aplicativo?
4. Parar e descer da moto; andar em todas as direções/diagonais com velocidade variável; aproximar-se e montar novamente.
5. Testar câmera, zoom, pedestre, colisões e aceleração/freio como antes.
6. Medir FPS do HUD nos perfis gráficos leve/alto após 3–5 minutos. Registrar capturas, orientação, ergonomia e problemas.
7. A interface não apresenta mais **Instalar app**; o Chrome não registra novo service worker. Se houve PWA instalado no passado, remover manualmente o ícone/aplicativo Android.

## Continuidade do desenvolvimento

- Trabalhar na branch `setup/weblab-foundation`, atualizando PR #1; **não fazer merge**.
- Antes de qualquer publicação executar `npm ci`, `npm run validate:repo`, `npm run test:unit`, `npm run typecheck`, `npm run build:staging`.
- O roteiro `tests/e2e/play.cjs` foi atualizado para eventos do analógico, mas **não roda na CI**; se acessível executar em Chromium com Playwright e documentar evidências reais.
- Publicar preview somente com autorização e após CI verde, usando `.github/workflows/preview.yml`, sem alterar a `main`.
- Atualizar `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md`, `docs/CHANGELOG.md`, registrando SHA e testes de fato executados.

Não adicionar backend, login, multiplayer, economia, scanner ou mapa definitivo nessa etapa. Sem novas assinaturas, serviços pagos ou assets comprados.
