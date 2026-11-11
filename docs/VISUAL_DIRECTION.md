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
