# ADR-0002 — Branches, features e ambientes

**Status:** ESCOLHA DE ENGENHARIA REVERSÍVEL, não requisito de gameplay.

**Problema:** impedir duas cópias divergentes do jogo e não permitir que uma IA leve feature experimental à produção sem aprovação.

**Decisão:** código único em `src/`, organizado por feature. Branches feat/fix/docs/setup criam PR; CI produz artefato de staging; deploy de produção só manual a partir de `main` revisada. Ambientes se distinguem por `.env.*`, não cópia de pastas.

**Atenção:** a existência dos workflows não configura branch protection nem Pages automaticamente.
