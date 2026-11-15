# Próxima atualização aprovada para implementação: HUD-001 + CTRL-001

**Ponto de partida:** `preview` da baseline LOG-006 consolidada na `main`. Para execução, criar branch temporária `feat/hud-001-mobile-controls` a partir da HEAD da `preview`; não reativar PWA, Easter egg, versões históricas, custos ou assets não solicitados.

## HUD-001 — Interface adaptativa Android paisagem

- Priorizar área central livre. Painel de objetivo curto; relógio/velocidade na direita; minimapa legível e expansível; botões confortáveis em safe areas.
- Modos de **pilotagem**, **a pé/coleta** e **base** usando estados existentes, sem criar novos estados de logística.
- Separar progresso **meu** de **equipe**; manter inventário/IDs e informações detalhadas dentro de Logística. Não apagar dados operacionais.
- Unificar CSS acumulado, revisar sobreposição de botões e resolução 915×412 / 780×360. Corrigir marca antiga “EXPERIMENTO · RUAS E SINALIZAÇÃO” e fallback HTML do relógio 11h45.

## CTRL-001 — Analógico flutuante responsivo

**Motivação informada pelo usuário:** o analógico atual para controlar a moto está **muito duro**. Corrigir de maneira observável, e não apenas trocar a aparência.

- O controle atual tem centro fixo e zona morta radial `STICK_DEADZONE=0.12`, raio físico `0.36×` largura; `responsiveMotoSteer()` aplica curva não linear; `motorcyclePhysics.ts` limita esterço por velocidade (`steerSpeedRef=7.5`, `maxLateralAccel=8`). Auditar as três camadas separadamente.
- Implementar joystick **flutuante dentro de uma zona segura no canto inferior esquerdo**: centro no `pointerdown` inicial e acompanhamento limitado quando o polegar chega à borda; nunca capturar toques sobre minimapa, pausa ou botões da direita.
- **Moto:** usar eixo X horizontal como direção progressiva, sem exigir deslocamento excessivo do polegar; Y do analógico não acelera/freia; preservar botões separados. Recalibrar curva/deadzone e, apenas se ensaios comprovarem necessidade, a relação esterço/velocidade; evitar sensibilidade exagerada em alta velocidade.
- **A pé:** manter 360° de movimento, sem regressão da direção diagonal e dos comandos de teclado.
- Preservar multitouch acelerador + curva, pointer capture, `pointercancel`, `lostpointercapture`, blur, troca de janela, orientação e resets. Sem movimento fantasma, drift ou `NaN`.
- Sem nova dependência: implementar no `VirtualJoystick` existente e em utilitários puros, inspirando-se apenas no padrão documentado de joystick dinâmico, sem instalar nipplejs.
- Parâmetros documentados e facilmente reversíveis; comparar comportamento antigo/novo em baixa (~10 km/h), média (~25 km/h) e alta (~40 km/h), com deflexões de 25%/50%/75% e direção esquerda/direita, evitando aumento injustificado de colisões.
- Atualizar `tests/analogStick.test.ts`, testes de física e E2E touch com dois dedos, liberação, rotação e resolução; proteger jornada, pacotes e NPCs.

## Gates antes de publicar

1. Testes existentes + `npm run check` (sem relaxar assertivas) e E2E Chromium com trânsito.
2. Capturas comparativas de HUD / toque em 915×412 e 780×360.
3. Evidência de que entrada/saída da moto, botões, minimapa, pausa, calendário, logística e navegador continuam funcionando.
4. Teste real no Galaxy S24 para calibrar ergonomia; Chromium não substitui hardware.
5. PR para `preview` após CI. Não mesclar na `main` nem publicar Pages sem solicitação explícita.

**Status:** ESPECIFICAÇÃO ATUALIZADA, implementação e testes da HUD-001/CTRL-001 **não iniciados**.
