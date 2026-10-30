param([Parameter(Mandatory=$true)][ValidateSet('v1','v2','v3')][string]$Version)
$ErrorActionPreference = 'Stop'
$port = @{v1=30001;v2=30002;v3=30003}[$Version]
$forward = Start-Process -FilePath 'kubectl.exe' -ArgumentList @('port-forward',"service/social-app-$Version",'-n','social-app-course',"$($port+1000):3000",'--address','127.0.0.1') -WindowStyle Hidden -PassThru
try {
    $result = $null
    for ($i=0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        try { $result = Invoke-RestMethod "http://127.0.0.1:$($port+1000)/health" -TimeoutSec 3; break } catch {}
    }
    if ($null -eq $result -or $result.status -ne 'ok' -or $result.version -ne $Version) { throw 'Deployed health check failed' }
    $config=Invoke-RestMethod "http://127.0.0.1:$($port+1000)/api/config" -TimeoutSec 5
    if ($config.features.likes -ne ($Version -ne 'v1') -or $config.features.comments -ne ($Version -eq 'v3')) { throw 'Deployed features do not match the release' }
    Write-Output "PASS: Kubernetes service social-app-$Version returned healthy $Version with the correct features."
    $config | ConvertTo-Json
} finally { if (-not $forward.HasExited) { Stop-Process -Id $forward.Id -Force } }
