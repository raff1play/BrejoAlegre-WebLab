# Adendo para protótipo WEB LAB — prioridade de execução

**Status: decisão de prototipagem solicitada após o documento-mestre.** Este arquivo não altera nem substitui o contrato de produção Godot.

## Objetivo

Provar, a custo baixo, se o Brejo Alegre Delivery Simulator é visualmente convincente e divertido no navegador. Protótipo **single-player**, experimental, descartável. Se as ideias forem validadas, iniciar o jogo de produção em Godot do zero usando conhecimento e ativos reutilizáveis.

## Diferenças aprovadas para o laboratório

- **Motor**: Babylon.js + TypeScript + Vite, render WebGL no Chrome/desktop; a versão Godot é futura, separada.
- **Plataforma**: navegador; touchscreen na horizontal no Android e teclado no desktop.
- **Infraestrutura**: sem servidor dedicado, banco remoto, autenticação, multiplayer, custos obrigatórios ou novas assinaturas. Dados podem ser locais quando necessário.
- **Geografia**: o mapa definitivo **ainda** pretende refletir a geografia real de Brejo Alegre, mas o teste inicial usa uma rua fictícia com identificação VISÍVEL de placeholder. Não afirmar que a cidade real foi mapeada.
- **Visual**: usar fotos/imagens geradas por IA como referências aspiracionais, NÃO como renderização Babylon comprovada. Implementar modelos 3D reais e medir FPS no navegador.
- **Estado**: a existência de um arquivo fonte não comprova funcionamento, performance ou aprovação de gameplay. Testar no dispositivo real antes de declarar.

## Marco 0.0 — Starter técnico preparado neste kit

- Projeto organizado, scripts de desenvolvimento/build, protótipo 3D em primitivas, controles teclado/touch, câmera e modo a pé.
- **Build e typecheck foram comprovados na CI remota do GitHub em 11/11/2026** (execução 43022470633), mas **não houve demonstração de runtime real** no navegador ou Android. A instalação npm local original teve EAI_AGAIN.

## Marco 0.1 — Entrega esperada do Fable

1. Instalar dependências e gerar `package-lock.json`; corrigir erros de TypeScript/build.
2. Executar e demonstrar um fluxo real jogável: direção com velocidade, frenagem, curvas; descer, andar e montar; giro/zoom da câmera; controles no celular.
3. Melhorar a aparência de **uma rua fictícia** inspirada nas referências, sem usar imagens IA como skybox fingindo 3D. Pelo menos cinco casas, calçadas, muros, portões, postes, árvores, uma fachada comercial genérica e moto de carga.
4. Implementar/ajustar colisões básicas para impedir atravessar paredes; não anunciar física de moto real antes de implementar.
5. Instrumentar FPS, 2 perfis gráficos (mobile/desktop), resize e prevenção de bugs de touch/tecla presa.
6. Validar com `npm run build` e teste manual no navegador; testar em Android real se houver acesso, sem inventar resultados.
7. Preparar instruções de deploy gratuito no GitHub Pages, mas **NÃO publicar** sem autorização explícita posterior.
8. Não criar backend, sistemas de pacote, pagamentos, mapa real nem outros sistemas fora do escopo.

## Requisitos de controle

- Alterações isoladas em `raff1play/BrejoAlegre-WebLab` se ele existir; não tocar em RadarPro, Ofertou, Mapa-051-V2, Labirinto13 ou SSF.
- Nesta tarefa inicial, continuar na branch existente `setup/weblab-foundation` e atualizar o PR #1, sem duplicar a estrutura nem fazer merge/deploy.
- Entregar código, teste e evidências; não entregar apenas relatório, mockup ou vídeo AI.
- Não gastar dinheiro; não criar contas ou serviços externos sem autorização adicional.
