# PowerShell 기반 초경량 로컬 웹 서버 (server.ps1)
$port = 5173
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host " 성남시 부동산 GIS 대시보드 로컬 서버 가동" -ForegroundColor Green
    Write-Host " 접속 주소: http://localhost:$port/" -ForegroundColor Cyan
    Write-Host " 종료하려면 이 창에서 Ctrl + C를 누르세요." -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Green
    
    # 자동으로 브라우저 열기
    Start-Process "http://localhost:$port/"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }
        
        # 파일 경로 탐색 (한글 경로 인코딩 처리)
        $decodedPath = [System.Web.HttpUtility]::UrlDecode($urlPath)
        $filePath = Join-Path $PSScriptRoot $decodedPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Content-Type 헤더 지정
            if ($filePath.EndsWith(".html")) {
                $response.ContentType = "text/html; charset=utf-8"
            } elseif ($filePath.EndsWith(".css")) {
                $response.ContentType = "text/css; charset=utf-8"
            } elseif ($filePath.EndsWith(".js")) {
                $response.ContentType = "application/javascript; charset=utf-8"
            } elseif ($filePath.EndsWith(".geojson")) {
                $response.ContentType = "application/json; charset=utf-8"
            }
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: " + $filePath)
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "오류 발생: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
}
