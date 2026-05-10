Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

# Configure test parameters here. No command-line arguments required.
$BaseUrl = "http://localhost:5000"
$FilePath = "C:\Users\lenovo\Downloads\textbooks\03_生理学.pdf"
$WaitForCompletion = $true
$PollIntervalSeconds = 3

$resolvedFile = Resolve-Path -LiteralPath $FilePath
$fileInfo = Get-Item -LiteralPath $resolvedFile

if (-not $fileInfo.Exists) {
    throw "文件不存在: $FilePath"
}

$uploadUrl = "$($BaseUrl.TrimEnd('/'))/api/textbooks/upload"

Write-Host "Uploading file:" $fileInfo.FullName
Write-Host "Target API:" $uploadUrl

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromMinutes(30)

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
            throw "上传失败，HTTP 状态码: $([int]$response.StatusCode)"
        }

        $payload = $responseBody | ConvertFrom-Json

        if ($payload.items.Count -eq 0) {
            throw "上传接口未返回教材记录。"
        }

        $textbookId = $payload.items[0].id
        $statusUrl = "$($BaseUrl.TrimEnd('/'))/api/textbooks/$textbookId/status"
        $detailUrl = "$($BaseUrl.TrimEnd('/'))/api/textbooks/$textbookId"

        if ($WaitForCompletion) {
            Write-Host "`nPolling parse status:" $statusUrl

            while ($true) {
                Start-Sleep -Seconds $PollIntervalSeconds
                $statusResponse = $client.GetAsync($statusUrl).GetAwaiter().GetResult()
                $statusBody = $statusResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                $statusPayload = $statusBody | ConvertFrom-Json

                Write-Host "`nStatus:"
                $statusBody | Write-Host

                if ($statusPayload.status -eq "ready" -or $statusPayload.status -eq "failed") {
                    break
                }
            }
        }

        Write-Host "`nFetching full parsed structure:" $detailUrl
        $detailResponse = $client.GetAsync($detailUrl).GetAwaiter().GetResult()
        $detailBody = $detailResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()

        Write-Host "`nFull textbook detail:"
        $detailBody | Write-Host
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
