# Segurança do protótipo web

- Não incorporar API keys, tokens de GitHub ou credenciais em código, Vite `.env` ou bundle público. Variáveis `VITE_*` são expostas no cliente.
- Não usar dados pessoais reais de destinatários, fotos privadas ou endereços privados; NPCs e lojas são fictícios.
- Nenhum login, analytics ou backend é necessário para a versão 0.1. Se proposto futuramente, exigir aprovação de privacidade, custo e escopo.
- Não instalar pacotes aleatórios sem avaliar integridade, manutenção e licença.
- Vulnerabilidades identificadas devem ser descritas sem publicar segredo no issue/PR.
