# Pendências, riscos e decisões em aberto

| ID | Prioridade | Status | Ação / decisão |
|---|---|---|---|
| B001 | Alta | RESOLVIDO em 11/11/2026 | Integração GitHub voltou a criar branch/arquivos; verificar PR #1. Não realizar push manual duplicado. |
| B002 | Média | PARCIALMENTE RESOLVIDO | Instalação e build passaram no GitHub Actions; o ambiente local de preparação teve EAI_AGAIN. Ainda falta criar/versionar package-lock.json e usar npm ci. |
| B003 | Alta | NÃO TESTADO | Renderização, controles, colisões e câmera no navegador real; build CI não prova gameplay. |
| B004 | Alta | NÃO TESTADO | Chrome Android/Galaxy S24, FPS, termal, toque em landscape. |
| B005 | Média | PENDENTE | Qualidade visual ainda feita com primitivas; modelagem licenciada necessária para meta semirrealista. |
| B006 | Média | PROVISÓRIO | Colisores AABB não representam física de moto, portões nem suspensão. Evitar prometer Havok. |
| B007 | Média | PENDENTE | Geografia, setorização real de Brejo Alegre e rotas; não implementar sem verificação de fonte/licença. |
| B008 | Média | PENDENTE | Regras futuras de saída antecipada, custo de manutenção, preço de veículos, bônus de equipe. Nenhuma aprovada além do mestre. |
| B009 | Média | PENDENTE | Proteções de branch e Pages não estão habilitadas só por existirem arquivos YAML. Requer configuração explícita. |
| B010 | Baixa | PENDENTE | Perfil gráfico mobile/desktop com ajustes baseados em medição, não apenas sinalizador de ambiente. |

Não marcar bloqueio como corrigido sem evidência de execução, timestamp e, quando aplicável, SHA/PR.

- **R-PERF-001 (aberto):** bundle JS principal do build staging ~7,2 MB pré-gzip; priorizar imports Babylon específicos, lazy loading onde justificável e medições reais de carregamento em Chrome Android. Não confundir tamanho do bundle com FPS medido.

- **R-VISUAL-002 (aberto):** as imagens conceituais anteriores não foram incluídas no GitHub; referência textual em `docs/VISUAL_DIRECTION.md`. Não fingir que o agente viu imagens não versionadas.
