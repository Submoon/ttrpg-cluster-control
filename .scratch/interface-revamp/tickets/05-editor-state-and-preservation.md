---
title: Define revamp guarantees for drafts, selection, and saving
status: closed
assignee: SOL 6.1 High
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../spec.md
---

## Resolution

Resolved 2026-10-13. Drafts are session-only and owned independently of panel visibility, responsive mounting and theme. Hiding/reopening preserves target, content and validation. A draft excludes only commands that change its entity or actual dependencies; independent work, pan and zoom remain available.

Leaving modified work uses Apply / Discard / Stay. Apply validates against the latest committed workspace and publishes valid memory before durable saving; validation failure or Stay preserves the draft and context. A successful Apply ends the form even if storage later fails. Saving, Saved on this device and Not saved stay distinct; Retry writes the latest memory and cannot replay an edit or creation. Keep current JSON export and recovery from the last valid snapshot available after write failure. Drafts are not persisted.

Exports use validated applied memory, even if saving is pending or failed. Exporting cannot apply/discard work or change live editor state.
