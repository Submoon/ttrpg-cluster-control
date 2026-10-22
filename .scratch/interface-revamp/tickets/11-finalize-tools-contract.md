---
title: Finalize the tools contract after the Astra interface review
status: closed
assignee: SOL 6.1 High
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../spec.md
---

## Resolution

Resolved 2026-10-15 through the human's answers to Q1–Q10. Navigate is the default: short system activation opens its map; drag pans without changing geometry. Select edits data without entering a system, and Move deliberately manipulates existing geometry. Inspect and Hierarchy remain independent of tool mode; numeric editing is available while Select is active.

Add is persistent and type-specific. Successful placement leaves that type active; creating a system keeps the Cluster map open; a completed route starts fresh. Creation does not force Inspect open or retarget a draft. Invalid targets explain the issue without mutation; ambiguous candidates require an explicit choice. Dismissing the chooser preserves Add, while Quit Add/Escape cancels only unfinished creation and returns to Navigate.

Two-contact and right-button drag navigate in every mode. Taking over a gesture cancels its uncommitted preview and suppresses its later release/click, while preserving prior commits, drafts and a chosen Jump Route origin. Context changes accepted by the draft guard reset to Navigate; refused changes retain current state. Keyboard and single-pointer alternatives remain required.

This supersedes ticket 03's one-shot Add and successful-Add reset clauses. The [specification](../spec.md#user-stories) carries normative coverage. No implementation or browser test was performed for this decision.
