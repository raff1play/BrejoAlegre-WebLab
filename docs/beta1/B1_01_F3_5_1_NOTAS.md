# B1-01 — F3.5.1: menu principal completo (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Status:** F3.5.1 entregue para revisão, conforme o adendo de [`B1_01_F3_5_MENU_CARREIRAS.md`](B1_01_F3_5_MENU_CARREIRAS.md#adendo-f351--menu-principal-completo) e o comentário 6903570909 do PR #15. **B1-01 NÃO está concluído**; F4–F7 não iniciadas. **NÃO PUBLICADO.** As 17 decisões, AC-01–AC-26 e `docs/beta1/STATE.json` não foram alterados.

## O que mudou

| Item | Arquivo | Conteúdo |
|---|---|---|
| Regras da tela principal (puras) | `src/core/career/careerMenu.ts` (`mainScreen`, `isFreeSlot`) | Calculadas só a partir do modelo de leitura (`menuModel` → `CareerStore.readAll`). **Novo jogo:** personagens com `source === 'novo'` e sem problema de leitura; calendário legado e save ilegível nunca são "livres". **Continuar:** a carreira ativa apenas se `saved` (principal ou cópia anterior íntegra) e não bloqueada. **Carregar:** os quatro cards; carregável quando há progresso salvo (ou o calendário legado Oeste) e nada bloqueia |
| Mensagem de ativação | `careerMenu.ts` (`ActivationError`) | Se o perfil é gravado e só a gravação de `ACTIVE_CAREER_KEY` falha: erro próprio dizendo que o perfil **foi** gravado e que a carreira ativa continua a anterior. Demais falhas continuam "A escolha NÃO foi gravada". Depois de qualquer falha o menu relê os saves |
| Tela principal e navegação | `index.html`, `src/style.css`, `src/features/career/mainMenu.ts` | Telas início → lista (Novo/Carregar) → detalhe (o mesmo da F3.5) e Opções. Voltar e Esc: detalhe → lista de origem; lista/Opções → início. Continuar entra com os presets e o veículo exatamente como salvos. Status nos cards: carreira nova, salva, cópia anterior utilizável, save corrompido, calendário antigo (Oeste) |
| Opções | `src/config/graphics.ts` (`graphicsChoice`, `saveGraphicsPreference`), `mainMenu.ts`, `src/main.ts` | Perfil gráfico real `mobile`/`desktop`, gravado na mesma chave `brejo-weblab-gfx` já usada pela pausa; como o motor só nasce depois do menu, vale sem recarregar. Mostra se o perfil vem da URL (`?gfx=`), do salvo ou automático. Ajuda de controles (toque e teclado). "Gerenciar saves (apagar, exportar/importar backup)" aparece como **indisponível — F6**; não existe exclusão |
| Documentação | `docs/beta1/B1_01_F3_5_MENU_CARREIRAS.md` (adendo), `B1_01_HANDOFF_AGENT.md` (linha F3.5.1), `B1_01_CONTRATOS_INTEGRACAO.md` (item 4.1) | Sem tocar no contrato congelado nem no `STATE.json` |

Não há novo sistema de saves: tudo passa por `menuModel`/`CareerStore`/`enterCareer` da F3.5. Persistência e jogo depois da entrada são os mesmos da F3.5.

## Testes

- `tests/b1-01-menu.test.ts` (17 testes; 6 novos da F3.5.1):
  - armazenamento vazio: Continuar indisponível (nunca inicia Oeste), Novo jogo com os quatro, nada carregável, nada gravado;
  - Novo jogo lista só os livres; com os quatro ocupados não há slot e nada é sobrescrito; calcular a tela não grava;
  - calendário legado e save corrompido não são livres; legado é carregável e não vira Continuar automático;
  - expediente aberto: Continuar só a carreira travada, Novo jogo e as outras bloqueados;
  - cópia anterior utilizável permite Continuar; ativa corrompida sem cópia não;
  - ressalva da auditoria: perfil gravado + apontador falhou → `ActivationError` com mensagem verdadeira, perfil realmente gravado, carreira anterior ativa; outra falha continua `SaveError` comum.
- `tests/e2e/current-smoke.cjs` (toque, 780×360 e 915×412):
  - tela principal na URL limpa (quatro entradas, Continuar indisponível com motivo, layout, HUD oculto);
  - Carregar jogo sem carreiras carregáveis; Opções com perfil da URL, ajuda, F6 indisponível, sem controles inventados, layout; Esc volta;
  - Novo jogo com quatro cards, detalhe, Voltar para a lista; nenhuma gravação ao navegar tudo;
  - quatro carreiras por Novo jogo (sem `?gfx`: perfil "Leve" escolhido em Opções gravado e usado pelo jogo); com os quatro salvos Novo jogo indisponível sem sobrescrever e Continuar oferece a última; Carregar mostra "Carreira salva" nos quatro; Opções → "Completo" + Continuar entra na carreira ativa como salva, com perfil desktop, sem gravar save;
  - calendário legado: não é livre nem Continuar automático; carregado por Carregar jogo;
  - expediente aberto: Continuar mostra Rosa com expediente, Novo jogo travado com motivo, Carregar com os outros bloqueados; Continuar preserva dia/expediente;
  - fluxos anteriores (moto, carro, porta-malas) inalterados, agora pela tela principal.

## Pendências

- AC-17 em jogo normal depende de F5/F6 gravarem o expediente aberto.
- Apagar/sobrescrever carreira, exportar e importar backup: F6.
- Botão "voltar ao menu" durante o jogo não existe (proposital: não abandonar turno não persistido).
- O botão Voltar do Android (histórico do navegador) não é interceptado; a navegação usa os botões Voltar e Esc.
- Nomes/cores provisórios; prévia 2D. **Galaxy S24 físico: NÃO TESTADO.**
