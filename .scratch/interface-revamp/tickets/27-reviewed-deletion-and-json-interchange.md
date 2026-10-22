---
title: 'Review destructive changes and exchange independent JSON copies safely'
status: closed
assignee: ticket27
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 27: Review destructive changes and exchange independent JSON copies safely

## Scope

Stories 94–98 and 100; checks 3, 9, 15, 27, 36–43, 47–49, 58, 61, 78–80, 82–93, 99, 107–110, 120. Families B1, B4–B9. Preserve reviewed deletion, independent JSON copies, current work, and persistence recovery from the [specification](../spec.md#user-stories).

## Resolution

Completed 2026-10-22 from feature baseline 8379b2901c88ebe3fcd1198ffa8b0175ddecbbe2. Deletion/import reviews prepare without mutation, renew changed effects, retain unrelated work, remap copied entities, and preserve applied recovery JSON after a save failure.

Typecheck/build and all eight new product tests pass. The single full run is 169/180; eleven obsolete navigation/wording/tab-order expectations were corrected without weakening data assertions and pass 11/11 on unchanged application/compiled hashes. No fresh 180/180 run is claimed. Physical-device evidence remains unavailable. The [original QA record at cleanup baseline](https://github.com/Submoon/ttrpg-cluster-control/blob/cf469857862565c58047fee98f8f174bee845c7c/.scratch/interface-revamp/implementation-lab/ticket-27-2026-10-22/qa/README.md) retains detailed identities and limitations.
