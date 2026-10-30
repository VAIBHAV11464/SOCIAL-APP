$ErrorActionPreference = 'Stop'
$runtime = Join-Path $PSScriptRoot '../data'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$kubectl = (Get-Command kubectl.exe -ErrorAction Stop).Source
foreach ($version in @('v1','v2','v3')) {
    $port = @{v1=30001;v2=30002;v3=30003}[$version]
    $health = $null
    try { $health = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2 } catch {}
    if ($health) {
        if ($health.version -eq $version) { Write-Output "$version already available at http://localhost:$port"; continue }
        throw "Port $port is used by a different application."
    }
    $out = Join-Path $runtime "forward-$version.log"
    $err = Join-Path $runtime "forward-$version-error.log"
    $forward = Start-Process -FilePath $kubectl -ArgumentList @('port-forward','-n','social-app-course',"service/social-app-$version", "$($port):3000",'--address','127.0.0.1') -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    $ready = $false
    for ($i=0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        try { $health=Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2; if ($health.version -eq $version) { $ready=$true;break } } catch {}
    }
    if (-not $ready) { throw "Could not start $version forwarding. See $err" }
    [PSCustomObject]@{id=$forward.Id;version=$version;started=$forward.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime "forward-$version.json")
    Write-Output "$version ready at http://localhost:$port (Kubernetes service social-app-$version)"
}
