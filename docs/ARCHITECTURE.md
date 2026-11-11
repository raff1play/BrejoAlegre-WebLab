# Arquitetura do Web Lab — simplicidade verificável

## Visão

```text
index.html / HUD CSS
        |
      main.ts (composição)
       /  |  \
     input camera (Babylon.js Scene)
        |      |
     features/ -> core/ -> world/
        |               |
     moto/pedestre   cena temporária + colisores

config/environment.ts <- .env.development / .env.staging / .env.production
```

`src/core/` contém regras puras que não importam Babylon.js; `tests/` exercita essas regras sem renderer. `src/features/` possui comportamento e controle; `src/world/` constrói o cenário provisório; `src/main.ts` faz a composição, não deve absorver mecânicas de gameplay futuras. `src/config/` só define ambiente e flags de apresentação.

## Caminho da requisição para o teste

Teclado/touch → `GameInput.pressed` → controlador moto/pedestre → proposta de posição → `MotionGuard` do mundo → atualização de posição → cena/câmera/HUD → render no canvas.

## Limitações PROPOSITADAS

- Colisão é teste determinístico de círculo contra retângulo, em X/Z: **não é solver de física de moto, nem colisão dinâmica**.
- Arte em primitivas; sem modelo de carga, combustível ou sistema de NPC. Não ocultar essa diferença.
- Não há backend. O bundle deve poder executar em hospedagem estática sem servidor próprio.
- Salvar progresso, inventário e domínio de pacotes **não existem na 0.1**; se protótipos futuros os testarem, priorizar módulos locais e testes puros.
- Não reservar trabalho para sincronização ENet/UDP nesta fase: seria complexidade descartável.

## Restrições técnicas

- Módulos importam em uma direção simples: `features` pode importar `core`; `core` NÃO importa `features`, Babylon ou DOM.
- Configuração via `VITE_*` é pública no bundle. Nunca adicionar chaves privadas em `.env` do Vite.
- Scripts de migração/infraestrutura e segredos são proibidos no protótipo local sem decisão explícita.
- Não carregar assets pesados antes de provar FPS e orçamento gráfico no celular.

## Critério de separação

Nova feature → pasta `src/features/<name>/` com controlador e API clara; regras independentes → `src/core/` + teste unitário; modelos/arte → `public/assets/` com manifesto de licença; dados geográficos → `src/world/` com proveniência e aviso de placeholder quando aplicável.
