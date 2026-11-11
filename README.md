# Brejo Alegre Web Lab — protótipo single-player no navegador

> **Estado: FUNDAÇÃO PUBLICADA NA BRANCH `setup/weblab-foundation`, AINDA NÃO TESTADA NO NAVEGADOR.** Repositório: https://github.com/raff1play/BrejoAlegre-WebLab. PR em rascunho: https://github.com/raff1play/BrejoAlegre-WebLab/pull/1. A `main` não foi alterada. O código está versionado e a compilação completa passou no GitHub Actions; **browser, Android e FPS continuam sem evidências de execução real**.

**O que é:** laboratório 3D descartável (Babylon.js 9.35.0 + TypeScript 5.9.3 + Vite 7.3.0), feito para experimentar direção, interações e direção de arte por navegador desktop ou Android. Não é o jogo final em Godot e não existe multiplayer ou backend nesta fase.

**Importante:** O antigo erro 403 da integração GitHub foi resolvido; o registro histórico está em `docs/GITHUB_UPLOAD_BLOCKER.md`. Para começar, leia `docs/PROJECT_STATE.md` e `docs/NEXT_TASK_FOR_FABLE.md`. Não fazer merge/deploy sem aprovação.

**CI remoto (11/11/2026):** [execução #43022470633](https://github.com/raff1play/BrejoAlegre-WebLab/actions/runs/43022470633) passou na validação, testes e build de staging na HEAD `a4201dae`; alterações posteriores exigem nova verificação. **Ainda não há teste real no navegador ou no Android, nem deploy.**

**Leia antes de implementar:** [`AGENTS.md`](AGENTS.md) → [`docs/00_START_HERE.md`](docs/00_START_HERE.md) → [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) → [`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md) → [`docs/NEXT_TASK_FOR_FABLE.md`](docs/NEXT_TASK_FOR_FABLE.md). Essas referências foram criadas para outros chats e outras IAs trabalharem sem acesso a memória externa.

## Rodar no computador

É preciso **Node.js >=22.12**, npm e conexão ao registro npm ao menos na primeira instalação.

```sh
npm install --no-audit --no-fund
npm run validate:repo
npm run test:unit
npm run typecheck
npm run dev
```

Abra http://localhost:5173. Para testar no Chrome Android da mesma rede Wi-Fi, abra `http://IP_DO_COMPUTADOR:5173` e autorize a conexão no firewall local. A orientação horizontal é recomendada.

```sh
npm run build:staging       # compilação de pré-validação, sem deploy
npm run build:production    # gera dist/ para publicação, sem deploy
npm run preview             # serve dist/ localmente
```

**Não confundir ambientes com cópias de código:** `src/features/` organiza mecânicas; `.env.development/.env.staging/.env.production` selecionam o modo; `dist/` é criado pelos builds. GitHub Actions só publica Pages após execução manual de workflow na branch `main`, depois de aprovado.

## Controles já escritos no código inicial (funcionamento NÃO comprovado em navegador)

| Ação | Desktop | Android |
|---|---|---|
| Acelerar / caminhar | W / ↑ | ▲ |
| Frear / ré ou caminhar para trás | S / ↓ | ▼ |
| Virar | A/D ou ←/→ | ◀/▶ |
| Descer/montar moto parada e próximo | F | Botão Montar/Descer |
| Girar câmera | Q/E | ↶/↷ |
| Zoom | Scroll do mouse | ＋/－ |

## Código e organização

```text
src/
  core/               # matemática e regras puras testáveis
  config/             # perfis dos ambientes (sem segredos)
  features/
    driving/          # moto, comportamento e estado
    walking/          # personagem a pé
    controls/         # teclado e toque
  world/              # mundo temporário sem validade cartográfica
  main.ts             # composição da cena, não lógica de domínio
  style.css           # HUD e responsividade

tests/                # testes determinísticos sem Babylon/browser
scripts/              # validação da integridade do repositório
docs/                 # requisitos, decisões, estado e handoff
.github/workflows/    # CI staging; produção manual e protegida
```

## Limites da versão 0.1

- Cena fictícia de rua, 3D em formas básicas, moto simplificada e personagem básico. Colisão com edifícios é aproximação por retângulos; não é física Havok.
- Ainda faltam modelos realistas, iluminação melhor, refinamento dos controles e testes num Android verdadeiro.
- A meta de 30 FPS em dispositivo intermediário é **alvo**, não número medido.
- As imagens do Runway são referências artísticas, nunca prova de renderização Babylon. **O JPG de referência não foi versionado neste primeiro commit**; solicitar a imagem original quando precisar de uma comparação visual.
- Mapa geograficamente fiel, NPCs logísticos, entrega, inventário, scanner, economia e multiplayer são etapas posteriores.

## Estado de validação

Ver `docs/PROJECT_STATE.md`. Durante a preparação o npm registry retornou `EAI_AGAIN`, por isso nenhum `package-lock.json` confiável pôde ser criado e a compilação completa depende de ambiente com acesso ao npm. Na primeira instalação bem-sucedida, **versionar o `package-lock.json` e trocar o CI de `npm install` para `npm ci`**.

## Licenciamento e gastos

Babylon.js e ferramentas abertas não exigem assinatura do motor. Não utilizar assets, marcas oficiais ou dados privados sem licença/consentimento. Não contratar serviços nem publicar sem aprovação. Repositório público **não significa** que todos os arquivos de arte tenham licença aberta; não supor permissões de redistribuição.
