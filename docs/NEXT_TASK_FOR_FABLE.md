# Próxima tarefa

**FLUXO ATUAL (12/11/2026) — PRIORIDADE:** a branch de desenvolvimento é **`preview`**, derivada da CORE-012, com CI a cada push. O deploy usa exclusivamente o arquivo de autorização `docs/PREVIEW_DEPLOY_TRIGGER.md`, após pedido explícito do usuário e liberação única de `preview` em `github-pages`. Leia `docs/WORKFLOW.md`. Não criar `feat/core-013` nem novos PRs para ajustes comuns. O PR #6 de consolidação para `main` só será mesclado após revisão e aceite; os PRs #2–#5 foram fechados sem merge. O Easter egg W010–W012 foi descartado, e a branch do experimento foi excluída; todas as branches antigas foram removidas, restando apenas `main` e `preview`. **As instruções históricas de branch abaixo são registro, não ação vigente.**


**CORE-012 (12/11/2026):** câmera dupla GTA/ISO implementada na branch `feat/core-012-gta-camera` (base CORE-011). Checar CI, testar alternância e colisão visual no navegador/Android real, avaliar FPS e só publicar após autorização. Não misturar com Easter egg W010–W012.


**CORE-011 (12/11/2026):** assets reais do Poly Haven integrados na branch `feat/core-011-real-assets` (PR em rascunho). Próximo: testar no Galaxy S24 (B038); para ampliar com assets estilizados, liberar os hosts de B036.

**CORE-010 (12/11/2026):** remasterização visual da vitrine na branch `feat/core-010-visual-remaster` (PR em rascunho). Antes de expandir a outras áreas: avaliar no Galaxy S24 luz, folhagem alfa, libré e FPS (B033/R-PERF-004); se aprovada, aplicar o mesmo padrão à mercearia e ao cruzamento. Para assets externos, liberar os hosts listados em B032.

---

# Tarefa anterior — — validar W009 principal (visual) e direção W008 no Galaxy S24

**Atualização 12/11/2026:** a W009 (moto, entregador e vitrine de cinco fachadas) foi implementada e testada em Chromium headless (47 testes unitários, 44 verificações de navegador). É a **última linha principal aprovada para continuidade**: branch `feat/weblab-core-w009`, PR #2, a partir do commit `bc453402` antes de W010. **Não misturar o Easter egg W010–W012**, que permanece arquivado na antiga branch `setup/weblab-foundation`/PR #1 encerrado. A W009 foi publicada anteriormente no Pages, mas o site foi depois substituído pelo experimento W012. **A nova branch limpa não foi publicada**; para testar exatamente esse código sem novo deploy, rodar `npm ci`, `npm run dev` e abrir `http://IP_DO_COMPUTADOR:5173` no Chrome Android na mesma rede.

Checklist adicional da W009 no aparelho:
1. A moto e o entregador parecem melhores e legíveis na câmera padrão? Mãos ficam nas manoplas ao virar? Pé esquerdo desce ao parar?
2. Descer e montar: a animação curta incomoda ou atrasa a sensação de controle?
3. A vitrine (logo ao norte do cruzamento, perto da loja) parece uma rua brasileira? Algo exagerado (pedra portuguesa, manchas, sombras de contato)?
4. FPS do HUD na vitrine nos perfis **leve** e **alto** após 3–5 minutos, comparado à W008; aquecimento.

Se faltar FPS, seguir R-PERF-003 em `docs/ISSUES_AND_RISKS.md` antes de remover qualquer melhoria.

---

## Tarefa anterior (ainda válida) — validar no Galaxy S24 a direção recalibrada da moto (W008)

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

- Trabalhar exclusivamente na branch `feat/weblab-core-w009`, atualizando PR #2; **não fazer merge**. Não incorporar código de W010–W012 da branch experimental.
- Antes de qualquer publicação executar `npm ci`, `npm run validate:repo`, `npm run test:unit`, `npm run typecheck`, `npm run build:staging`.
- O roteiro `tests/e2e/play.cjs` foi atualizado para eventos do analógico, mas **não roda na CI**; se acessível executar em Chromium com Playwright e documentar evidências reais.
- Publicar preview somente com autorização explícita e após CI verde, sem alterar a `main`. O workflow atual `.github/workflows/preview.yml` está limitado à branch experimental antiga; antes de publicar uma versão W009 limpa, revisar esse fluxo com aprovação do usuário.
- Atualizar `docs/PROJECT_STATE.md`, `docs/ISSUES_AND_RISKS.md`, `docs/CHANGELOG.md`, registrando SHA e testes de fato executados.

Não adicionar backend, login, multiplayer, economia, scanner ou mapa definitivo nessa etapa. Sem novas assinaturas, serviços pagos ou assets comprados.
