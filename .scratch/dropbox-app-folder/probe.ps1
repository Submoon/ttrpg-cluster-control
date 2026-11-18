#Requires -Version 5.1
param([string]$RecheckReport)

# Historical probe for the withdrawn shared-destination detection requirement.
# It is not a current product qualification or part of the Dropbox integration.
# Current setup and live checks: docs/dropbox-setup.md and docs/cloud-backup-verification.md.
# Historical cases, measurements, and the withdrawn false-negative interpretation: qualification.md.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Invoke-DropboxProbe {
    param([string]$Endpoint, [hashtable]$Arguments, [byte[]]$Bytes)

    $json = $Arguments | ConvertTo-Json -Compress
    if ($Endpoint -eq 'files/upload') {
        $hostName = 'content.dropboxapi.com'
        $content = [Net.Http.ByteArrayContent]::new($Bytes)
        $content.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::new('application/octet-stream')
        [void]$content.Headers.TryAddWithoutValidation('Dropbox-API-Arg', $json)
    } else {
        $hostName = 'api.dropboxapi.com'
        $content = [Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, 'application/json')
    }

    try {
        $response = $client.PostAsync("https://$hostName/2/$Endpoint", $content).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $data = $null
        if ($body.TrimStart().StartsWith('{')) {
            $data = ConvertFrom-Json -InputObject $body
        }
        $errorTag = [regex]::Match([string]$data.error_summary, '^[a-z0-9_/]+').Value
        return @{ status = [int]$response.StatusCode; errorTag = $errorTag; data = $data }
    } catch {
        return @{ status = $null; errorTag = 'request_failed'; data = $null }
    } finally {
        if ($response) { $response.Dispose() }
        $content.Dispose()
    }
}

function Get-LinkEvidence {
    param([hashtable]$Arguments)

    $result = Invoke-DropboxProbe 'sharing/list_shared_links' $Arguments
    $linkCount = $null
    if ($result.status -eq 200 -and $null -ne $result.data.links) {
        $linkCount = @($result.data.links).Count
    }
    [ordered]@{
        directOnly = $Arguments.direct_only
        status = $result.status
        errorTag = $result.errorTag
        linkCount = $linkCount
        hasMore = $result.data.has_more
    }
}

function Get-TargetEvidence {
    param([string]$Path, [switch]$CheckId)

    $metadata = Invoke-DropboxProbe 'files/get_metadata' @{ path = $Path; include_has_explicit_shared_members = $true }
    $item = $metadata.data
    $evidence = [ordered]@{
        path = $Path
        metadataStatus = $metadata.status
        metadataErrorTag = $metadata.errorTag
        hasSharingInfo = [bool]$item.sharing_info
        hasExplicitSharedMembers = $item.has_explicit_shared_members
        hasSharedFolder = [bool]$item.sharing_info.shared_folder_id
        hasSharedParent = [bool]$item.sharing_info.parent_shared_folder_id
        links = @(foreach ($directOnly in @($true, $false)) {
            Get-LinkEvidence @{ path = $Path; direct_only = $directOnly }
        })
    }
    if ($CheckId) {
        $evidence.linksById = @(if ($item.id -like 'id:*') {
            foreach ($directOnly in @($true, $false)) {
                Get-LinkEvidence @{ path = $item.id; direct_only = $directOnly }
            }
        })
    }
    return $evidence
}

if ($RecheckReport) {
    $previousRun = Get-Content -LiteralPath $RecheckReport -Raw | ConvertFrom-Json
    $recheckFile = [string]$previousRun.fixture
    if ($previousRun.issue -ne 55 -or $recheckFile -notmatch '^(/issue55-probe-[0-9a-f]{12})/synthetic-backup\.json$') {
        throw 'Select a report created by the issue 55 probe.'
    }
    $recheckFolder = $Matches[1]
}

$secureToken = Read-Host 'Paste the temporary token for the test App Folder' -AsSecureString
$handler = [Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(20)

try {
    $token = [Net.NetworkCredential]::new('', $secureToken).Password.Trim()
    if ($token -notmatch '^[A-Za-z0-9._-]+$') { throw 'Enter a Dropbox access token.' }
    $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
    $token = $null

    if ($RecheckReport) {
        $choice = Read-Host 'Can a separate session still open the JSON via your folder link? [Y/N]'
        $recheck = [ordered]@{
            issue = 55
            fixture = $recheckFile
            folderLinkAccessConfirmed = $choice.Trim() -eq 'y'
            capturedAtUtc = [DateTime]::UtcNow.ToString('o')
            targets = @((Get-TargetEvidence $recheckFolder -CheckId), (Get-TargetEvidence $recheckFile -CheckId))
            currentUserInventoryFirstPage = Get-LinkEvidence @{}
        }
        $name = $recheckFolder.TrimStart('/') + '-link-recheck-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff') + '.json'
        $recheckPath = Join-Path ([IO.Path]::GetTempPath()) $name
        $recheck | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $recheckPath -Encoding utf8
        Write-Host "Link recheck saved to $recheckPath"
        return
    }

    $folder = '/issue55-probe-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    $file = "$folder/synthetic-backup.json"
    $reportPath = Join-Path ([IO.Path]::GetTempPath()) ($folder.TrimStart('/') + '.json')
    $created = Invoke-DropboxProbe 'files/create_folder_v2' @{ path = $folder; autorename = $false }
    if ($created.status -ne 200) { throw "Fixture folder create failed ($($created.status) $($created.errorTag))." }
    $sample = [Text.Encoding]::UTF8.GetBytes('{"synthetic":true,"purpose":"Dropbox App Folder qualification for issue 55"}')
    $uploaded = Invoke-DropboxProbe 'files/upload' @{ path = $file; mode = 'add'; autorename = $false } $sample
    if ($uploaded.status -ne 200) { throw "Fixture upload failed ($($uploaded.status) $($uploaded.errorTag)). Inspect $folder in the test App Folder." }

    Write-Host "Fixture in the test App Folder: $file"
    $report = [ordered]@{ issue = 55; fixture = $file; observations = @() }
    $cases = @(
        'private'
        'direct file link'
        'folder link inherited by file'
        'App Folder root link'
        'Apps ancestor link'
        'direct file invitation'
        'invitee-created file link'
        'direct folder invitation'
        'App Folder root invitation'
        'inherited folder membership'
    )
    foreach ($case in $cases) {
        if ($case -eq 'private') {
            $outcome = 'baseline'
        } else {
            Write-Host "Apply this case using the qualification guide: $case"
            do {
                $choice = (Read-Host '[A] access confirmed, [B] Dropbox blocked it, [U] access unverified, [S] skip, [Q] save and quit').Trim().ToLowerInvariant()
            } until ($choice -in @('a', 'b', 'u', 's', 'q'))
            if ($choice -eq 'q') { break }
            $outcome = @{ a = 'access-confirmed'; b = 'blocked-by-dropbox'; u = 'unverified'; s = 'skipped' }[$choice]
        }

        $targets = @()
        if ($outcome -ne 'skipped') {
            $targets = @((Get-TargetEvidence $folder), (Get-TargetEvidence $file))
        }
        $report.observations += [ordered]@{
            case = $case
            uiOutcome = $outcome
            capturedAtUtc = [DateTime]::UtcNow.ToString('o')
            targets = $targets
        }
        $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding utf8
        Write-Host "Evidence saved to $reportPath"
        if ($outcome -in @('access-confirmed', 'unverified')) {
            Write-Host 'Remove the link or access after this measurement and before setting up the next case.'
        }
    }
} finally {
    $client.Dispose()
    $secureToken.Dispose()
}
