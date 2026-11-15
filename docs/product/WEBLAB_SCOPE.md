# Escopo do Web Lab — versão atual (15/11/2026)

Este laboratório é um jogo **single-player no navegador** feito em Babylon.js + TypeScript + Vite para validar Brejo Alegre Delivery Simulator sem exigir servidor, banco ou subscrições adicionais. Não é uma implementação Godot/Android nativa nem multiplayer.

A versão atual inclui mapa de ruas derivado de OSM, 8 lojas fictícias, 1 jogador e 3 motoboys NPC, 4 setores, operação de loja e galpão, inventário rastreável de pacotes, triagem física e calendário. O jogador pode dirigir ou caminhar com controles touch; motor e ambiente 3D funcionam localmente no navegador.

**Prioridade atual:** testes de regressão com trânsito ambiente, preparação da nova HUD e estabilidade mobile. Não adicionar economia permanente, matchmaking, financiamento, login, servidores ou scanner real como consequência da limpeza.

A visão final Godot e suas regras de carreira, coop, dinheiro e entregas estão preservadas no documento independente `ORIGINAL_GODOT_SPEC.md`; qualquer futura mudança dessa visão requer decisão própria.

A geografia OSM e a representação fictícia de estabelecimentos devem permanecer corretamente atribuídas. Testes automatizados não são evidência de FPS real de aparelho.
