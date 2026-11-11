# Publicação no GitHub — bloqueio 403 e resolução segura

Em 11/11/2026, o repositório público `raff1play/BrejoAlegre-WebLab` existe, `main` inclui só um README inicial. O conector GitHub reporta permissão `push: true` no metadado, **mas chamadas de escrita** `create_branch` e `create_file` falharam com:

```text
HTTP 403: Resource not accessible by integration
```

**Isso normalmente indica que o aplicativo integrado não dispõe das permissões de escrita necessárias nessa instalação**, mesmo que a conta possua acesso ao repositório. Não há evidência de criação de branch ou arquivos remotos.

## Caminho recomendado

1. Verificar/reautorizar a conexão GitHub que o ChatGPT utiliza, incluindo permissão efetiva para editar o conteúdo de `raff1play/BrejoAlegre-WebLab`. A autorização depende da instalação/configuração do aplicativo e pode não ser ajustável em chat.
2. Depois de autorizar, pedir novamente para importar o scaffold em **branch `setup/weblab-foundation`**, e nunca diretamente na `main`.
3. Se a autorização da integração continuar bloqueada, usar Git instalado/autenticado com `scripts/PUBLICAR_NO_GITHUB.ps1` (Windows) ou `scripts/publicar-no-github.sh` (Linux/macOS). São scripts de backup que clonam a `main` real, criam branch, copiam o código e fazem push; **não fazem merge, deploy nem mudanças em outros repositórios**.
4. Abrir PR manual comparando `setup/weblab-foundation` com `main`. Verificar CI e aprovar merge separadamente.

Não colocar tokens, senhas ou credenciais neste repositório nem no chat. **Não usar GitHub Pages antes da aprovação do usuário.**
