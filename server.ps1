# Lightweight Local Web Server (server.ps1)
$port = 5173
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host " Seongnam Housing GIS Local Web Server" -ForegroundColor Green
    Write-Host " Access URL: http://localhost:$port/" -ForegroundColor Cyan
    Write-Host " Press Ctrl + C to stop the server" -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Green
    
    # Auto-open browser
    Start-Process "http://localhost:$port/"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }
        
        # URL decode path (handles non-English character routes)
        $decodedPath = [System.Uri]::UnescapeDataString($urlPath)
        $filePath = Join-Path $PSScriptRoot $decodedPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Set content type
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
    Write-Host ("Error occurred: " + $_) -ForegroundColor Red
} finally {
    $listener.Stop()
}
