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

try {
    [SleepBlocker]::SetThreadExecutionState(
        [SleepBlocker]::ES_CONTINUOUS -bor
        [SleepBlocker]::ES_SYSTEM_REQUIRED
    ) | Out-Null

    Set-Location $PSScriptRoot
    npm run dev
}
finally {
    [SleepBlocker]::SetThreadExecutionState([SleepBlocker]::ES_CONTINUOUS) | Out-Null
}