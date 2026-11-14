# Correção do piso da base

Branch `feat/art-001-primeira-loja-moto`, base anterior `190b7a0`. Sem alteração de outras branches, publicação ou merge.

## Causa auditada

- `temporaryWorld.ts`: plano global de grama em **−0,06 m**, contínuo sob o galpão.
- `cityBuild.ts`: grama da quadra em **0,138 m**, também contínua sob a base.
- `depotArchitecture.ts`: concreto de todo o lote, asfalto do pátio e piso interno todos em **0,168 m**, com áreas sobrepostas. No pátio existiam dois pisos principais exatamente coplanares.
- As faixas, a circulação verde, juntas e remendos também eram desenhados em **0,168 m**. A ordem de renderização podia escolher concreto, asfalto ou pinturas conforme a câmera/GPU.

A inspeção dos triângulos realmente carregados no navegador está em `before/audit.json`: por exemplo, no pátio havia duas superfícies de grama e dois pisos principais sob a mesma coordenada. O defeito reproduzido inclui competição entre concreto/asfalto; não foi tratado apenas como uma textura verde errada.

## Correção

1. Recortado o retângulo orientado da base tanto no terreno global quanto na grama da quadra q3. A subtração é geométrica, mantendo UVs e terreno fora da base.
2. Os pisos principais agora formam uma partição do lote: concreto externo, asfalto do pátio e piso interno são adjacentes, sem uma laje contínua sob os outros.
3. Piso visível na altura física existente **CURB_H = 0,15 m**. Não foram alterados terrenos de colisão, obstáculos, controles, física da moto ou lógica logística.
4. Pinturas em materiais próprios da base, com prioridade de profundidade para remendos → juntas → faixa de pedestres → demarcações. O bias dos materiais compartilhados da cidade não foi alterado. Cantos das linhas de vagas foram recortados para não desenhar a mesma pintura duas vezes.

Arquivos de código: `src/world/surfaceCut.ts`, `src/world/city/depotFloor.ts`, integração em `temporaryWorld.ts`, `cityBuild.ts` e `depotArchitecture.ts`. Regressões geométricas em `tests/depotFloor.test.ts`. Scripts reproduzíveis em `scripts/floor-fix/`.

## Evidências reais

[Comparador antes/depois](comparison.html). Três câmeras idênticas em cada perfil: estacionamento, pátio e transição. Desktop 1280×720; móvel emulado 780×360. Chromium/SwiftShader, sem retoque ou imagem IA.

- `npm run check`: **113/113 testes unitários**, validação, TypeScript strict e build de staging aprovados: [check.txt](check.txt).
- Auditoria da geometria completa de chão dentro dos **3.676,08 m²** da base, nos dois perfis: terreno residual numérico ≈ **9×10⁻¹⁰ m²** (zero dentro da tolerância), área do piso principal **3.676,080024 m²**, sem duplicação de cobertura. Planos decorativos identificados por materiais de decal separados e bias negativo: [verification.json](verification.json).
- Órbita/zoom durante **24 quadros renderizados em cada perfil**, sem erros de navegador. Moto acelerou e freou sobre a altura física original **0,15 m**: [browser.txt](browser.txt).
- As capturas finais foram inspecionadas: asfalto limpo no pátio, concreto no estacionamento, sem a mistura observada anteriormente.

```sh
npm run dev -- --port 5173
node scripts/floor-fix/capture.cjs docs/evidence/floor-fix/after
node scripts/floor-fix/verify.cjs
npm run check
```

O antes foi capturado na base intacta antes da edição; não sobrescrever essa pasta ao reproduzir o depois. O servidor local precisou ser reiniciado durante a verificação; isso não envolveu publicação.

## Limite da validação

Celular **emulado**, com perfil gráfico móvel, não é Android físico. Não foi testado em aparelho real. Nos cenários e movimentos verificados não foi observada competição entre os pisos; a geometria concorrente foi removida em toda a área, em vez de depender apenas de uma pequena diferença de altura.
