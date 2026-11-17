# B1-01 — F2: carro jogável e veículo neutro (nota técnica para auditoria)

**Branch:** `feat/beta1-01-carreiras` (PR #15, draft). **Status:** F2 entregue para revisão técnica. **B1-01 NÃO está concluído**: F3–F7 não foram iniciadas. **NÃO PUBLICADO.** Este documento não altera as 17 decisões, AC-01–AC-26 nem `docs/beta1/STATE.json`.

## O que a F2 implementa

| Requisito | Arquivo | Conteúdo |
|---|---|---|
| Escolha única do veículo (decisões 5–6, AC-03) | `src/core/career/careerBoot.ts` (`chooseCareerVehicle`), `src/features/career/vehicleChoice.ts`, `index.html` (`#vehicle-choice`), `src/main.ts` (`bootBrowserCareer`) | A carreira ativa é carregada **antes** do mundo. Sem veículo, abre a tela "Veículo de <nome>": moto antiga **ou** carro popular antigo, próprio e quitado. A escolha vira checkpoint do save da carreira (`chooseStartingVehicle` da F1); segunda escolha, mesmo igual, é recusada; outra aba com sessão desatualizada também é recusada. Só o veículo da carreira é construído (carreira de carro não ganha moto). `?veiculo=…` pré-seleciona apenas em desenvolvimento/`devtime=1` |
| Física do carro | `src/core/carPhysics.ts` | Modelo arcade puro e determinístico (bicicleta cinemática + limite de aderência), **separado** de `motorcyclePhysics.ts`: 3,85 × 1,62 m, entre-eixos 2,44 m, ~60 km/h, 3,4 m/s², ré a 3 m/s, esterço máx. ~32° (raio ≈ 3,9 m), aderência 7 m/s², volante mais lento que o guidão, freio de mão quando estacionado. A ré exige soltar o freio após parar (não "rola para trás"); encostado na parede, arma ao soltar o acelerador (sempre consegue sair) |
| Colisores | `carPhysics.ts` (`CAR_FOOTPRINT`, `carFits`, `carBodyHits`) | 22 círculos (6 na linha central com meia-largura + 16 nos cantos) contidos na carroceria e cobrindo-a com folga ≤ 6 cm (verificado numericamente); mundo estático, portas de lojas, portão da base e trânsito usam o mesmo `MotionGuard`. Para pedestres, retângulo orientado exato: o carro estacionado é sólido |
| Entrar/sair | `carPhysics.ts` (`findCarExit`, `canEnterCar`, `doorSpot`) | Só parado; sai pelo lado do motorista (esquerda), senão passageiro, senão por trás; nunca dentro da carroceria nem em obstáculo; sem espaço → recusa com mensagem. Entra só junto a uma porta dianteira (≤ 1,35 m). Porta abre/fecha no modelo |
| Estacionamento | `src/world/city/depotPlan.ts` (`depotCarBay`), `main.ts` | Ao sair, freio de mão puxado (o carro não se move com nenhum comando). Vaga da base reconhecida só com os **quatro cantos** dentro da pintura de `CAR_PARKING` e parado; o carro nasce em uma dessas vagas, de frente para o portão |
| Veículo neutro | `src/features/driving/playerVehicle.ts` | Interface `PlayerVehicle` (estado, passo, sair/entrar, sólido para pessoas, encaixe, luzes, câmera, textos). O adaptador da moto apenas encaminha para `Motorcycle`/`motorcyclePhysics`/`mounting` com as **mesmas expressões** que `main.ts` usava; `main.ts` passou a falar só com a interface |
| Modelo 3D | `src/features/driving/playerCar.ts` | Hatch genérico e quadrado (sem marca/modelo real), uma pele rígida (uma malha por material), rodas que esterçam e giram, portas articuladas, motorista sentado (mesmo personagem articulado), lanternas de freio e farol à noite |
| Câmera | `src/features/camera/isometricCamera.ts` (`setDriveFraming`) | Enquadramento por veículo: carro 7,4 m / β 1,22 / alvo 1,15 m; a moto recebe os valores CTRL-002 originais (5,6 / 1,27 / 0,95) |
| Controles Android/teclado | `src/core/analogStick.ts` (`carTurnFraction`, `CAR_STICK`), `src/features/controls/input.ts` (`carSteer`) | Mesmos botões ▲ACELERAR/▼FREIO-RÉ e analógico flutuante; curva própria do volante (zona morta 6 %, saturação 75 %, ease 1,6). A curva da moto (CTRL-002) não foi alterada. HUD: "Sair do carro"/"Entrar no carro", "Dirigindo", legenda "C Seu carro" |

## Fronteira com F3/F4 (não antecipada)

- **Porta-malas, caixas, coleta/descarga/entrega pelo carro: NÃO implementados.** Na carreira de carro, interações de carga aparecem **indisponíveis** com o motivo "Carga pelo carro: porta-malas na próxima etapa (F3/F4)"; nenhum pacote vai para as mãos sem lugar para guardá-lo, e não existe contador de carga decorativo. O controle do portão da base continua funcionando. Os três NPCs, a base e o trânsito funcionam igual.
- Única interface estrutural adicionada para a F4: `depotCarBay` (vaga de carro da base). A custódia de pacotes continua toda no domínio de entregas (`Workday`), fora de `PlayerVehicle`.
- **Persistência da posição do carro estacionado** é F6 (checkpoints/retomada); hoje ele renasce na vaga da base.

## Decisões de engenharia (auditáveis, não são decisões de produto)

- Dimensões/velocidades do carro e a curva do analógico são calibração inicial, centralizadas em `CAR`/`CAR_STICK`; não há teste em Galaxy S24 físico.
- Cor do carro provisória; sem marca, emblema ou modelo real.
- Carreiras já existentes (inclusive o save legado migrado na F1) ainda sem veículo **também** passam pela escolha na primeira abertura — a decisão 5 exige escolha por carreira.

## Testes

- `tests/b1-01-car.test.ts` — 15 testes: cobertura dos colisores; aceleração/teto; freio sem rolar e ré; raio de giro e limite de aderência; volante vs. guidão; colisão em 24 ângulos × 5 esterços contra paredes e pilar sem penetração de canto > 6 cm; vão de 1,5 m bloqueia o carro e não a moto; sair da parede de ré; freio de mão; saída por motorista/passageiro/traseira/nenhuma; entrada só por porta; curva do volante e valores CTRL-002 intactos; vaga da base; escolha única persistida e isolada; sessão desatualizada recusada.
- `tests/e2e/current-smoke.cjs` — o fluxo existente da moto agora começa tocando "Moto antiga" na tela real de escolha (todas as verificações anteriores mantidas, sem diluir assertivas) e ganhou a seção **carreira de carro**: escolha por toque, vaga inicial, câmera, HUD sem sobreposição em 915×412 e 780×360 (base e rua), teclado até a cerca da base com carroceria livre em toda amostra e cantos ≤ 6 cm da cerca, ré, analógico + pedal com multitoque, freio por toque, sair (lado do motorista, freio de mão), andar contra o carro sem atravessar, entrar pela porta, recusa longe das portas, vaga 1 reconhecida, recarga sem nova escolha e saves inativos intocados.
- Chromium/SwiftShader emulando celular **não** prova FPS nem toque de Android físico.
