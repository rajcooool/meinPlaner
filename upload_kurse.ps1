$Token  = "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"
$Owner  = "rajcooool"
$Repo   = "meinPlaner"
$Branch = "main"
$Path   = "kurse_events.json"

$LocalFile = "D:\projekte\meinPlaner\meinPlaner\kurse_events.json"

$headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/vnd.github+json"
}

$apiUrl = "https://api.github.com/repos/$Owner/$Repo/contents/$Path"

# Aktuelle Datei/SHA von GitHub holen
$current = Invoke-RestMethod `
    -Uri "$apiUrl`?ref=$Branch" `
    -Headers $headers `
    -Method Get

$sha = $current.sha

# Lokale Datei Base64-codieren
$bytes   = [System.IO.File]::ReadAllBytes($LocalFile)
$content = [Convert]::ToBase64String($bytes)

$body = @{
    message = "Automatischer JSON-Export $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    content = $content
    sha     = $sha
    branch  = $Branch
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri $apiUrl `
    -Headers $headers `
    -Method Put `
    -ContentType "application/json" `
    -Body $body