---
status: accepted
date: 2026-11-13
---

# Restore a complete Jump Cluster as the active map

Opening a Jump Cluster backup from disk or cloud storage installs the saved Jump Cluster as the active map. The previous full-cluster append flow kept the destination chart's identity and title and remapped incoming relationships, which prevented faithful recovery. The replacement preserves the saved cluster and its complete source data and requires confirmation when a map is already active. Standalone star-system files retain reviewed copy import through an explicit add action.

The local workspace owner commits the replacement before publishing it to the editor. A successful restore establishes a fresh local workspace identity and undo baseline, preserves the prior valid snapshot under the rolling recovery policy, and rejects stale writes from tabs that still hold the displaced workspace. The confirmation offers a local download for keeping the previous cluster independently of the rolling snapshot. This decision supersedes the full-cluster append behavior documented in [ADR 0002](0002-player-publication-boundary.md) when portable restore ships. The portable source format and the separate player document retain their existing contracts.
