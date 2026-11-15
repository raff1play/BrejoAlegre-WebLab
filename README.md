# Brejo Alegre Delivery Simulator — Web Lab

**Estado atual:** laboratório jogável 3D, single-player, no navegador Android/desktop. Babylon.js 9.35, TypeScript 5.9, Vite 7.3. A implementação final multiplataforma/Godot e multiplayer **não faz parte deste repositório**.

**Jogo publicado:** https://raff1play.github.io/BrejoAlegre-WebLab/
**Código de trabalho:** branch `preview` • **Base estável:** branch `main`, apenas após integração e testes.
**Arquivo de recuperação pré-limpeza:** [snapshot LOG-006 (15/11/2026)](https://github.com/raff1play/BrejoAlegre-WebLab/tree/archive/2026-11-15-log006-published).

## Funcionalidades presentes

- Cidade baseada na rede viária OpenStreetMap de Brejo Alegre/SP; lojas, base, pessoas, números e plataformas representadas de forma fictícia. Licença e atribuição em [docs/CITY_REFERENCE.md](docs/CITY_REFERENCE.md).
- Moto com direção analógica, freio/acelerador, personagem que anda e monta/desmonta, câmera terceira pessoa, perfis gráfico mobile/desktop e minimapa de rotas.
- Oito lojas, um jogador e três motoboys NPC (Rosa, Caio, Davi); quatro setores/cargas; caminhão/van de abastecimento com chegada assistida; conferência/triagem física e entrega de pacotes com custódia única.
- Calendário e demanda por dia; começo **11h45**, NPCs iniciam deslocamento às **11h47**, coletas a partir das **12h**; meta de retorno **14h**, tolerância até **14h20**; separação até **15h** (ou **16h** em alta demanda). A jornada dura 150 segundos reais por hora virtual, sem contabilizar pausas e aceleração opcional.
- LOG-006: correção experimental de espera circular entre motociclistas e trânsito; **ainda exige validação longa com tráfego ativo no celular**.

## Desenvolver e testar

```sh
npm ci
npm run check
npm run dev
```

Node.js 22.12+. O comando `check` executa validação estrutural, testes unitários e compilação. Para testes de navegador, há `npm run test:e2e` com Playwright instalado no ambiente de execução (veja [docs/QUALITY_GATES.md](docs/QUALITY_GATES.md)). Nenhuma dependência de navegador é enviada ao jogador.

## Processo atual

1. Trabalhar em `preview`, com branch temporária somente para mudanças arriscadas.
2. CI rápida em cada push. Publicar no único GitHub Pages **somente após autorização explícita**; o gatilho é `docs/PREVIEW_DEPLOY_TRIGGER.md`.
3. `main` representa uma base revisada; integração por PR com testes aprovados, nunca publicar produção automaticamente.

**Não confundir:** teste unitário e build bem-sucedidos não homologam desempenho no Galaxy S24 ou funcionamento integral com trânsito. O navegador é o meio de teste atual; não reativar PWA, antigo Easter egg ou infraestrutura paga.

Leitura obrigatória: [docs/00_START_HERE.md](docs/00_START_HERE.md), [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md), [docs/ISSUES_AND_RISKS.md](docs/ISSUES_AND_RISKS.md).
