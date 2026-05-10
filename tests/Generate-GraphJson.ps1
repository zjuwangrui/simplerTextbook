Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

# Configure test parameters here.
$BaseUrl = "http://localhost:5000"
$TextInputFile = "D:\constructing_projects\simplerTextbook\tests\output\text.json"
$OutputFile = "D:\constructing_projects\simplerTextbook\tests\output\image.json"
$PollIntervalSeconds = 5

function Read-JsonArray([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return ,@()
    }

    $raw = Get-Content -Raw -Encoding UTF8 $Path
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return ,@()
    }

    $json = $raw | ConvertFrom-Json
    if ($json -is [System.Array]) {
        return ,@($json)
    }
    if ($null -ne $json) {
        return ,@($json)
    }
    return ,@()
}

$textRecords = @(Read-JsonArray $TextInputFile)
if ($textRecords.Count -eq 0) {
    throw "No parsed text record found. Run tests\Parse-Textbook.ps1 first."
}

$sourceRecord = $textRecords[-1]
$textbookId = $sourceRecord.metadata.textbook_id
if ([string]::IsNullOrWhiteSpace($textbookId)) {
    throw "Latest text record does not contain textbook_id."
}

$outputDir = Split-Path -Parent $OutputFile
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$generateUrl = "$($BaseUrl.TrimEnd('/'))/api/graphs/textbooks/$textbookId/generate"
$statusUrl = "$($BaseUrl.TrimEnd('/'))/api/graphs/textbooks/$textbookId/status"
$graphUrl = "$($BaseUrl.TrimEnd('/'))/api/graphs/textbooks/$textbookId"

Write-Host "Generating graph for textbook_id:" $textbookId
Write-Host "Generate API:" $generateUrl

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromMinutes(60)

try {
    $body = New-Object System.Net.Http.StringContent("{}", [System.Text.Encoding]::UTF8, "application/json")
    $generateResponse = $client.PostAsync($generateUrl, $body).GetAwaiter().GetResult()
    $generateBody = $generateResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    Write-Host "`nGenerate response status:" ([int]$generateResponse.StatusCode)
    Write-Host "Generate response body:"
    $generateBody | Write-Host

    if (-not $generateResponse.IsSuccessStatusCode) {
        throw "Failed to enqueue graph generation, HTTP status: $([int]$generateResponse.StatusCode)"
    }

    $finalStatusPayload = $null
    Write-Host "`nPolling graph status:" $statusUrl
    while ($true) {
        Start-Sleep -Seconds $PollIntervalSeconds
        $statusResponse = $client.GetAsync($statusUrl).GetAwaiter().GetResult()
        $statusBody = $statusResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $finalStatusPayload = $statusBody | ConvertFrom-Json

        Write-Host "`nGraph status:"
        $statusBody | Write-Host

        if ($finalStatusPayload.graph_status -eq "ready" -or $finalStatusPayload.graph_status -eq "failed") {
            break
        }
    }

    if ($finalStatusPayload.graph_status -ne "ready") {
        throw "Graph generation failed: $($finalStatusPayload.graph_error_message)"
    }

    $graphResponse = $client.GetAsync($graphUrl).GetAwaiter().GetResult()
    $graphBody = $graphResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $graphResponse.IsSuccessStatusCode) {
        throw "Failed to fetch graph JSON, HTTP status: $([int]$graphResponse.StatusCode)"
    }

    $graphPayload = $graphBody | ConvertFrom-Json
    Write-Host "`nGraph JSON:"
    $graphBody | Write-Host

    $record = [ordered]@{
        metadata = [ordered]@{
            recorded_at = [DateTime]::UtcNow.ToString("o")
            textbook_id = $textbookId
            title = $sourceRecord.metadata.title
            source_text_file = $TextInputFile
            source_file_path = $sourceRecord.metadata.file_path
            api_base_url = $BaseUrl
            graph_status = $finalStatusPayload.graph_status
        }
        description = "Visualization graph JSON generated from previously parsed textbook text."
        result = [ordered]@{
            parsed_output = $sourceRecord.result.parsed_output
            graph = $graphPayload
        }
    }

    $records = @(Read-JsonArray $OutputFile)
    $records += $record
    $records | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $OutputFile -Encoding UTF8

    Write-Host "`nResult appended to:" $OutputFile
}
finally {
    $client.Dispose()
    $handler.Dispose()
}
