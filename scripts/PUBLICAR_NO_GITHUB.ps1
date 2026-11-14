# Executar com PowerShell no Windows, a partir da pasta extraida.
# Requisitos: Git instalado e autenticado (ex.: Git Credential Manager).
# Nunca grava na main. Cria uma branch de preparacao + push, sem merge/deploy.
$ErrorActionPreference='Stop'
$project=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target=Join-Path (Split-Path $project -Parent) 'BrejoAlegre-WebLab-git-upload'
$branch='setup/weblab-foundation'
if (Test-Path $target) { throw "A pasta destino $target ja existe. Por seguranca, nao sobrescrever." }
& git clone 'https://github.com/raff1play/BrejoAlegre-WebLab.git' $target
if ($LASTEXITCODE -ne 0) {throw 'Falha ao clonar. Verifique Git/login e permissao ao repositório.'}
& git -C $target switch -c $branch
if ($LASTEXITCODE -ne 0) {throw 'Nao foi possivel criar branch.'}
Get-ChildItem -LiteralPath $project -Force | Where-Object {$_.Name -notin @('.git','node_modules','dist','.vite')} | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
}
& git -C $target add -A
& git -C $target status --short
& git -C $target commit -m 'chore: prepare web lab scaffold and AI source of truth'
if ($LASTEXITCODE -ne 0) {throw 'Falha no commit. Configure git user.name e user.email.'}
& git -C $target push -u origin $branch
if ($LASTEXITCODE -ne 0) {throw 'Falha no push. Nenhum merge/deploy foi feito.'}
Write-Host 'Branch publicada. Abra um PR manual em:'
Write-Host 'https://github.com/raff1play/BrejoAlegre-WebLab/compare/main...setup/weblab-foundation?expand=1'
