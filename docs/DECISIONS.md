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

