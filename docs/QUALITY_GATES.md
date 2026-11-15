# Portas de qualidade — projeto atual

## A. Mudança de código
- [ ] Escopo e dependências verificados; sem PWA, Easter egg ou novos custos não solicitados.
- [ ] `npm run validate:repo`, `npm run test:unit`, `npm run build:staging` aprovados.
- [ ] Testes preservam comportamentos observáveis e invariantes: IDs únicos, posse/estado, prazos, rota e colisão, sem afrouxar assertivas.
- [ ] Fonte de verdade e documentos curtos atualizados.

## B. Integração via navegador
- [ ] Chromium real inicia na horizontal sem erros de página.
- [ ] Relógio 11h45; três NPCs esperam 11h47 antes de sair, coleta não inicia antes de 12h.
- [ ] Trânsito ambiente ligado; motos estacionadas não bloqueiam vans indefinidamente.
- [ ] Loops de coleta, descarga, triagem, saca e entregas auditados com IDs sem saltos.
- [ ] Interface toque/analógico, câmera, minimapa e pausa funcionais.
- [ ] Capturas/logs identificam quando há fixture de desenvolvimento/SwiftShader em vez de condução humana.

## C. Android humano
- [ ] Galaxy S24 navegador real: FPS/temperatura, paisagem, controles táteis, visual e tráfego.
- [ ] Jornada normal e dia de demanda alta sem travamentos ou perdas de pacote.
- [ ] Não extrapolar evidência do Chromium para o hardware físico.

## D. Publicação/main
- [ ] PR revisto, testes aplicáveis aprovados, aceite do usuário para estabilizar.
- [ ] Publicação só com pedido explícito, verificar GitHub Actions Deploy preview success.
- [ ] `main` não publica automaticamente no Pages.

**Status:** A LOG-006 tem 145/145 unitários + build e deploy aprovado no commit `f98b652`. A branch HUD-001 tem 155/155 unitários, build e 73/73 verificações E2E no Chromium com trânsito (gate B parcial: entrega completa no navegador ainda não percorrida); gate C (Android físico) não executado.
