Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

# Configure test parameters here.
$BaseUrl = "http://localhost:5000"
$FilePath = "C:\Users\lenovo\Downloads\textbooks\数字滤波器设计讲义.pdf"
$WaitForCompletion = $true
$PollIntervalSeconds = 5
$OutputFile = "D:\constructing_projects\simplerTextbook\tests\output\text.json"

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

$resolvedFile = Resolve-Path -LiteralPath $FilePath
$fileInfo = Get-Item -LiteralPath $resolvedFile
if (-not $fileInfo.Exists) {
    throw "File not found: $FilePath"
}

$outputDir = Split-Path -Parent $OutputFile
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$uploadUrl = "$($BaseUrl.TrimEnd('/'))/api/textbooks/upload"
Write-Host "Uploading file:" $fileInfo.FullName
Write-Host "Target API:" $uploadUrl

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromMinutes(60)

try {
    $form = New-Object System.Net.Http.MultipartFormDataContent
    $stream = [System.IO.File]::OpenRead($fileInfo.FullName)

    try {
        $fileContent = New-Object System.Net.Http.StreamContent($stream)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
        $form.Add($fileContent, "files", $fileInfo.Name)

        $response = $client.PostAsync($uploadUrl, $form).GetAwaiter().GetResult()
        $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

        Write-Host "`nUpload response status:" ([int]$response.StatusCode)
        Write-Host "Upload response body:"
        $responseBody | Write-Host

        if (-not $response.IsSuccessStatusCode) {
            throw "Upload failed, HTTP status: $([int]$response.StatusCode)"
        }

        $uploadPayload = $responseBody | ConvertFrom-Json
        if ($uploadPayload.items.Count -eq 0) {
            throw "Upload API did not return any textbook record."
        }

        $textbookId = $uploadPayload.items[0].id
        $statusUrl = "$($BaseUrl.TrimEnd('/'))/api/textbooks/$textbookId/status"
        $detailUrl = "$($BaseUrl.TrimEnd('/'))/api/textbooks/$textbookId"
        $finalStatusPayload = $null

        if ($WaitForCompletion) {
            Write-Host "`nPolling parse status:" $statusUrl
            while ($true) {
                Start-Sleep -Seconds $PollIntervalSeconds
                $statusResponse = $client.GetAsync($statusUrl).GetAwaiter().GetResult()
                $statusBody = $statusResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                $finalStatusPayload = $statusBody | ConvertFrom-Json

                Write-Host "`nStatus:"
                $statusBody | Write-Host

                if ($finalStatusPayload.status -eq "ready" -or $finalStatusPayload.status -eq "failed") {
                    break
                }
            }
        }

        $detailResponse = $client.GetAsync($detailUrl).GetAwaiter().GetResult()
        $detailBody = $detailResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $detailResponse.IsSuccessStatusCode) {
            throw "Failed to fetch textbook detail, HTTP status: $([int]$detailResponse.StatusCode)"
        }

        $detailPayload = $detailBody | ConvertFrom-Json
        Write-Host "`nParsed textbook detail:"
        $detailBody | Write-Host

        $record = [ordered]@{
            metadata = [ordered]@{
                recorded_at = [DateTime]::UtcNow.ToString("o")
                file_path = $fileInfo.FullName
                filename = $detailPayload.filename
                textbook_id = $detailPayload.textbook_id
                title = $detailPayload.title
                total_pages = $detailPayload.total_pages
                total_chars = $detailPayload.total_chars
                api_base_url = $BaseUrl
                status = if ($null -ne $finalStatusPayload) { $finalStatusPayload.status } else { $detailPayload.status }
            }
            description = "Text parsing result saved as graph generation input."
            result = [ordered]@{
                parsed_output = $detailPayload.parsed_output
                detail = $detailPayload
            }
        }

        $records = @(Read-JsonArray $OutputFile)
        $records += $record
        $records | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $OutputFile -Encoding UTF8

        Write-Host "`nResult appended to:" $OutputFile
    }
    finally {
        if ($null -ne $stream) {
            $stream.Dispose()
        }
        if ($null -ne $form) {
            $form.Dispose()
        }
    }
}
finally {
    $client.Dispose()
    $handler.Dispose()
}
