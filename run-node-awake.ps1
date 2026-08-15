Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class SleepBlocker {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint esFlags);

    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
}
"@

$diskTimeoutValues = [regex]::Matches(
    (powercfg /query SCHEME_CURRENT SUB_DISK DISKIDLE),
    '0x[0-9a-fA-F]+'
)

# The final two hexadecimal values are the AC and DC timeout values.
$originalDiskTimeoutSeconds = $null
if ($diskTimeoutValues.Count -ge 2) {
    $originalDiskTimeoutSeconds = [Convert]::ToInt32($diskTimeoutValues[$diskTimeoutValues.Count - 2].Value, 16)
}

$diskTimeoutChanged = $false
try {
    [SleepBlocker]::SetThreadExecutionState(
        [SleepBlocker]::ES_CONTINUOUS -bor
        [SleepBlocker]::ES_SYSTEM_REQUIRED
    ) | Out-Null

    # While the server is running, keep the HDD powered on (AC power only).
    if ($null -eq $originalDiskTimeoutSeconds) {
        throw 'Could not read the current AC disk timeout; refusing to change it.'
    }

    powercfg /change disk-timeout-ac 0
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not disable the AC disk timeout.'
    }
    $diskTimeoutChanged = $true

    if (-not (Get-Process -Name ngrok -ErrorAction SilentlyContinue)) {
        $ngrokPath = (Get-Command ngrok -CommandType Application -ErrorAction Stop).Source
        Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', ('"{0}" http 3000' -f $ngrokPath)) -WorkingDirectory $PSScriptRoot
    }

    Set-Location $PSScriptRoot
    npm run dev
}
finally {
    if ($diskTimeoutChanged) {
        powercfg /change disk-timeout-ac ([Math]::Ceiling($originalDiskTimeoutSeconds / 60))
    }

    [SleepBlocker]::SetThreadExecutionState([SleepBlocker]::ES_CONTINUOUS) | Out-Null
}
