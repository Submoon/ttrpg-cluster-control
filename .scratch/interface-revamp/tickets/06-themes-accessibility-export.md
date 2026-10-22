---
title: Define the light/dark, accessibility, and export palette contract
status: closed
assignee: SOL 6.1 High
label: wayfinder:grilling
type: grilling
mode: HITL
parent: ../spec.md
---

## Resolution

Use one coherent light/dark palette across the shell, maps, portals and dialogs, with an OS-derived initial choice and a durable local override. Theme changes preserve workspace, selection, view, drafts and save state. Icons and resources required by the interface must work without an external network dependency.

Keep meaningful text at or above 4.5:1 contrast and meaningful controls/map graphics at or above 3:1 against adjacent colors. Show focus, selection and other important states with cues beyond color; verify visible, unobscured focus. These are acceptance targets, not a completed accessibility audit.

SVG and PNG exports show the full applied scene in the active palette or an export-only Light for printing palette. Exclude selection, handles, previews and unapplied drafts; make SVG standalone. Export must leave live state and theme unchanged. This is Warden-facing map export, not a player secrecy filter.
