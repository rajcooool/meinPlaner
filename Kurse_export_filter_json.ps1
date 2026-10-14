# Speicherort der JSON-Datei
$outputFile = "D:\projekte\meinPlaner\meinPlaner\kurse_events.json"

# ==============================================
# Fehlerausgabe & Logging aktivieren
# ==============================================
$ErrorActionPreference = "Stop"     # Stoppt bei jedem Fehler
$LogFile = "D:\projekte\meinPlaner\kurse_export_log.txt"

Start-Transcript -Path $LogFile -Append
Write-Host "===== Script gestartet: $(Get-Date) ====="

# ==============================================
# ODBC-Verbindung herstellen
# ==============================================
$connectionString = "DSN=basysword;UID=sa;PWD=U,jwg."
$conn = New-Object System.Data.Odbc.OdbcConnection($connectionString)
$conn.Open()

# In die richtige Datenbank wechseln
$cmd = $conn.CreateCommand()
$cmd.CommandText = "USE Chemnitz_VHS"
[void]$cmd.ExecuteNonQuery()

# ==============================================
# SQL-Abfrage: nur Events ab heute
# ==============================================
$query = @"
SELECT TITEL, INFO, ORT, NR_ANZEIGE,
       BEGINN_DAT, ENDE_DAT, BEGINN, ENDE
FROM KURSE
WHERE EXISTS (
  SELECT 1
  FROM KENNZ_AD a
  WHERE a.nr = KURSE.nr
    AND a.typ = N'K'
    AND a.kennz = N'5'
)
AND (
      BEGINN_DAT >= CONVERT(date, GETDATE())
   OR (ENDE_DAT   IS NOT NULL AND ENDE_DAT >= CONVERT(date, GETDATE()))
);
"@
$cmd.CommandText = $query

$da    = New-Object System.Data.Odbc.OdbcDataAdapter($cmd)
$table = New-Object System.Data.DataTable
[void]$da.Fill($table)

# ==============================================
# JSON-Struktur aufbauen
# ==============================================
$events = @()
$baseTicketUrl = "https://www.vhs-chemnitz.de/p/557-C-"

foreach ($row in $table.Rows) {

    # --- Datum & Zeit ---
    $dateFrom = ""
    if ($row.BEGINN_DAT) {
        if ($row.BEGINN_DAT -is [DateTime]) { $dateFrom = $row.BEGINN_DAT.ToString("yyyy-MM-dd") }
        else { $dateFrom = $row.BEGINN_DAT.ToString() }
    }

    $dateTo = ""
    if ($row.ENDE_DAT) {
        if ($row.ENDE_DAT -is [DateTime]) { $dateTo = $row.ENDE_DAT.ToString("yyyy-MM-dd") }
        else { $dateTo = $row.ENDE_DAT.ToString() }
    }

    $timeFrom = ""
    if ($row.BEGINN) {
        if ($row.BEGINN -is [DateTime]) { $timeFrom = $row.BEGINN.ToString("HH:mm") }
        else { $timeFrom = $row.BEGINN.ToString() }
    }

    $timeTo = ""
    if ($row.ENDE) {
        if ($row.ENDE -is [DateTime]) { $timeTo = $row.ENDE.ToString("HH:mm") }
        else { $timeTo = $row.ENDE.ToString() }
    }

    # --- Ort aufteilen: "Ort, Raum" ---
    $location = ""
    $room = ""
    if ($row.ORT) {
        $parts = $row.ORT -split ",", 2
        $location = ($parts[0]).Trim()
        if ($parts.Count -gt 1) { $room = ($parts[1]).Trim() }
    }

    # --- Ticket-URL zusammensetzen ---
    $ticketUrl = ""
    if ($row.NR_ANZEIGE -and $row.NR_ANZEIGE -ne [DBNull]::Value) {
        $nr = $row.NR_ANZEIGE.ToString().Trim()
        if ($nr) { $ticketUrl = $baseTicketUrl + $nr }
    }

    # --- JSON-Struktur ---
    $event = [ordered]@{
        title        = $row.TITEL
        description  = $row.INFO
        location     = $location
        room         = $room
        organizer    = ""
        images       = @()
        dates        = @(
            @{
                date_from = $dateFrom
                date_to   = $dateTo
                time_from = $timeFrom
                time_to   = $timeTo
            }
        )
        ticket_url   = $ticketUrl
        ticket_phone = ""
    }

    $events += $event
}

$jsonRoot = [ordered]@{ events = $events }

# ==============================================
# JSON-Datei ohne BOM speichern
# ==============================================
$jsonText = $jsonRoot | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($outputFile, $jsonText, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "✅ JSON-Datei exportiert (ohne BOM): $outputFile"

$conn.Close()
Stop-Transcript
