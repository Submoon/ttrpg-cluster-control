---
title: Restore a local Jump Cluster backup from welcome and recovery
status: open
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 02. Restore a local Jump Cluster backup from welcome and recovery

[Back up and restore a Jump Cluster](../spec.md) · [Portable restore decision](../../../docs/adr/0003-restore-complete-jump-cluster-backups.md)

## What to build

Open a complete local Jump Cluster backup directly from the welcome screen of a fresh profile or from the recovery screen when the local workspace is damaged. Reuse the complete backup validation and durable restore established in ticket 01.

## Blocked by

- [Replace the active Jump Cluster from a local backup](01-replace-active-jump-cluster.md), which supplies complete backup validation and the durable replacement workflow.

## Acceptance criteria

- [ ] From a fresh browser profile, the Warden can open a supported complete local JSON backup without creating a placeholder map. The restored cluster opens after IndexedDB commits and survives reload with its full content intact.
- [ ] When the local workspace is damaged, the recovery screen offers local file restore alongside **Restore last valid backup**. A successful file restore preserves an existing valid recovery snapshot.
- [ ] Cancellation, invalid input, failed persistence, or an obsolete restore request leaves the previous durable records intact. Reject a late restore that would overwrite a workspace installed while the file was being opened.
- [ ] Both screens use the same file eligibility rules as the editor's full restore. Local file restore works offline and with Drive unavailable.

## Verification

Exercise both public entry points with real IndexedDB. Reuse the existing recovery coverage to verify that a failed transaction preserves records and that last-valid recovery remains reachable. Cover request ownership and invalid input at the operation boundary. Follow the project's Sensitive development route.
