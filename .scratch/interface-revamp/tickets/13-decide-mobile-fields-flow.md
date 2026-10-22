---
title: Decide the mobile Fields list-to-editor flow
status: closed
assignee: codex-wayfinder-mobile-fields
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../spec.md
---

## Resolution

Confirmed by the human on 2026-10-15. On mobile, Fields uses list → read-only detail → explicit Edit within the available dialog area; desktop uses list and detail side by side. Fields and Manage resume the same session screen, selection and draft. Back hides detail and restores list position/focus without ending its draft; Close hides the dialog and restores focus to its opener.

New opens one guarded creation form. Apply opens the new definition's read-only detail; explicit Cancel abandons only that new draft. Changes to definitions/options and deletion keep explicit impact review and confirmation, preserving assigned values unless the reviewed operation removes them. Short-landscape and keyboard reachability remain acceptance obligations. This adds no durable draft storage or schema change.
