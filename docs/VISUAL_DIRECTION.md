# Direção visual verificável — Brejo Alegre Web Lab

**Status:** especificação de arte para o protótipo 0.1; NÃO é resultado técnico ou screenshot do motor. **Não modifica** D09 (mapa real do produto final) nem os demais requisitos congelados.

## Identidade pretendida

- Jogo 3D de câmera isométrica/oblíqua rotativa, ambientação de cidade pequena do interior paulista.
- Visual **semirrealista otimizado**: proporções plausíveis, casas térreas com telhas, fachadas comerciais originais, muros, portões, calçadas, asfalto, postes, arborização e moto de carga com baú.
- Texturas PBR moderadas, luz solar e sombras econômicas; evitar ray tracing, texturas enormes, dezenas de luzes dinâmicas e cenários que só ficam bonitos como imagem estática.
- Interface legível em tela horizontal de celular, sem cobrir a moto ou rua. Usar indicador de FPS; não exibir números inventados.
- **Visual não é mapa:** a cena 0.1 deve exibir o aviso "ÁREA TEMPORÁRIA DE TESTE — NÃO REPRESENTA BREJO ALEGRE". A geografia real exige dados verificáveis em fase futura.

## Referências e limites

As imagens e vídeos gerados por IA em conversas anteriores são **referência aspiracional**, não gravação do Babylon.js e nem arquivos 3D. **Não estão versionados nesta branch**; não fingir tê-los visto. Caso o usuário os disponibilize num PR posterior, registrar origem, autorização e uso.

Nesta etapa, descrever visual e gerar uma **captura autêntica da cena renderizada no navegador**. Não usar uma imagem de IA como fundo/screenshot para dar aparência de 3D.

## Ordem de investimento

1. Cena abrindo e moto realmente controlável, pedestre e câmera em funcionamento.
2. Colisões, controles touch e HUD sem falhas bloqueantes.
3. Uma rua com cinco fachadas, fachadas brasileiras, iluminação coerente, silhueta da moto e detalhes pequenos sem dependências pagas.
4. Perfis gráfico desktop/mobile, tamanho de bundle, medição de FPS e ajustes por dispositivo.
5. Comparar screenshots **reais** do browser aos objetivos visuais; registrar o que falta sem mascarar.

## Aceite visual inicial

- Modelos e materiais são objetos realmente renderizados pelo Babylon.js.
- Escala consistente entre personagem, veículo, calçada e casas.
- Pelo menos uma perspectiva isométrica mostrando rua, moto, casas e fachada comercial.
- Qualidade prioriza fluidez e legibilidade, não fotorealismo irrealista.
- A meta 30 FPS é hipótese até medição em aparelho real.

**Fontes de arte:** a cada asset de terceiros, atualizar `public/assets/ASSET_MANIFEST.md` com fonte, criador, licença, tamanho e alterações. Nunca supor licença por estar disponível online.

## Referência CORE-010 (vídeos do usuário, 12/11/2026)

Sete vídeos curtos (≈5 s) gerados por IA foram enviados na conversa; **não estão versionados** e são referência artística, não gravação do Babylon.js. Análise feita uma vez a partir de 2–3 quadros por vídeo:

- **Luz:** sol quente de fim de tarde, sombras longas e macias, céu azul com cúmulos, leve névoa quente, cores saturadas sem neon.
- **Profundidade:** morros verdes ao fundo com casario de telhado laranja, igreja com torre e caixa-d'água.
- **Arquitetura residencial:** casas térreas creme/brancas, telhado cerâmico laranja com beiral grosso, muros rebocados com pilares e capitel, rodapé de pedra, arandelas, placa de rua/número esmaltada, portões de grade, parabólicas.
- **Rua:** asfalto escuro limpo, faixas brancas nítidas e eixo amarelo, calçadas claras ou de pedra portuguesa, floreiras com flores vermelhas, postes de ferro coloniais, lixeiras, poste de concreto com transformador e fiação.
- **Vegetação:** copas volumosas e macias (oiti), ipê-roxo e ipê-amarelo, palmeiras, buganvílias caindo sobre os muros, vasos.
- **Personagem e moto:** moto amarela e preta com baú amarelo; entregador de jaqueta preta com painéis amarelos e capacete escuro.
- Fora do escopo desta etapa (aparecem nos vídeos): NPCs, carros, HUD de entregas, lojas comerciais com letreiros, base logística.

Implementação: `docs/PROJECT_STATE.md`, seção CORE-010. Comparações reais: `docs/evidence/core010-*.jpg`.
