# Decisões e precedência — log sem apagar histórico

## Regras

- Requisitos de produto confirmados durante o `/grill-me`: **D01–D17**, registrados integralmente em `product/ORIGINAL_GODOT_SPEC.md`. Não substituir por interpretações resumidas desta página.
- Uma decisão do Web Lab (`Wxx`) altera apenas o ambiente de **prototipagem**; não reescreve nem revoga a especificação Godot futura.
- Qualquer nova regra precisa de pedido do usuário, data, alternativas e impacto; propostas permanecem `PENDENTE` até confirmação explícita.

| ID | Estado | Regra para laboratório | Efeito sobre Godot final |
|---|---|---|---|
| W001 | CONFIRMADA (conversa 11/11/2026) | Protótipo **single-player web** com Babylon.js, TypeScript e Vite | Nenhum: Godot futuro permanece projeto independente |
| W002 | CONFIRMADA | Protótipo é **descartável**; se for aprovado, o jogo de produção será refeito do zero na Godot | Reutilizar especificação e modelos licenciados; não presumir reaproveitamento dos scripts |
| W003 | CONFIRMADA | Prioridade 0.1: cena dirigível, controles e visual, sem servidor/multiplayer/contabilidade | Mecânicas futuras permanecem previstas, não implementadas |
| W004 | CONFIRMADA | Nada de assinatura extra, deploy ou serviços pagos sem autorização | Nenhum |
| W005 | DECISÃO DE ENGENHARIA do scaffold (revisável) | Features por módulo; três perfis de ambiente; staging via CI e produção manual, sem cópia de fonte | Não vincula arquitetura do produto final |

## Invariantes do produto guardados como fonte

- D01 8–12 **paradas distintas** por humano, não 8–12 pacotes.
- D03 capacidade por dimensões, massa e compartimentos, não número fixo arbitrário de pacotes.
- D04 um único motor de custódia com eventos e scans idempotentes, quando essa etapa for feita.
- D05 quatro jogadores + servidor dedicado + NPC substituto são **futuro Godot**, não escopo web 0.1.
- D07 pagamentos por pacote físico efetivamente concluído; valores exatos na especificação.
- D09 fidelidade geográfica verificável a Brejo Alegre; cena fictícia temporária explicitamente sinalizada.
- D15 começar com assets provisórios; D16 demo visual primeiro; D17 congelar decisões, explicitar pendências.

**Pendências históricas** (saída antecipada após expedição, preços de veículos, verificação de setores e mapas, reconexão) permanecem sem aprovação. Não completar lacunas silenciosamente.

## W006 — Instalação PWA para teste (confirmada em 11/11/2026)

- Pedido explícito: transformar o laboratório web em aplicativo instalável para evitar o aviso cinza do Chrome ao solicitar fullscreen pela aba.
- Implementação aprovada **apenas para o Web Lab**: manifesto PWA com `display: standalone` e `orientation: landscape`, ícones originais, botão **Instalar app** e service worker de cache limitado ao projeto.
- O modo instalado **não** usa `requestFullscreen()` ao tocar no controle de rotação; a orientação é uma preferência sujeita às políticas Android/Chrome.
- Manter alternativa pelo navegador, sem inventar bloqueio forçado de rotação ou instalação já validada no Galaxy S24.
- Não altera nenhuma decisão D01–D17 da futura versão Godot, nem autoriza merge da `main` ou serviços pagos.

## W007 — Navegador primeiro e analógico proporcional (confirmada em 11/11/2026)

- Usuário pediu **cancelar/desativar o PWA por enquanto**, mantendo o jogo no navegador. W007 prevalece sobre W006 **somente para o estado operacional do Web Lab**; preservar o histórico da tentativa PWA.
- Remover `rel=manifest`, chamadas de instalação/registro e botões **Instalar app** do jogo. Encerrar apenas o antigo service worker do Web Lab e limpar apenas caches com prefixo exclusivo `brejo-weblab-`. Não tocar nos caches de outros apps ou no armazenamento de progresso.
- Substituir as setas na parte inferior esquerda por **analógico virtual real**, com movimento contínuo, zona morta, limite radial e reset ao soltar/cancelar o toque, perder foco ou mudar de modo.
- **Na moto:** analógico X = esterço proporcional. Acelerar e frear continuam separados, à direita. **A pé:** analógico X/Y = caminhada em 360° com velocidade proporcional, mantendo teclado no PC.
- Continuar com animação de câmera, colisões e controles existentes, sem servidor ou serviços pagos. Medir ergonomia/FPS no aparelho real antes de dizer que melhorou.
- A `main` e o jogo Godot final não são alterados. Publicar somente na prévia autorizada do Pages, após testes aprovados.
