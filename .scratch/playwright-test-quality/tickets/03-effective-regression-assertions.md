---
title: Correct ineffective gesture, recovery and observer assertions
status: closed
assignee: ticket-03-agent
type: implementation
spec: ../spec.md
triage_labels:
  - bug
  - ready-for-agent
---

# 03: Correct ineffective gesture, recovery and observer assertions

## Specification

[Reliable, focused Playwright tests and shared testing guidance](../spec.md)

F1-F5 and preservation of F9; user stories 19-23; completion criteria 3 and 8.

## What to build

The five confirmed coverage defects fail when their named contract is broken, so a green test demonstrates the behavior it claims to protect.

## Scope and handoff

Own F1-F5 assertion and precondition corrections, preserving existing test boundaries and product behavior. Keep the corrections independently verifiable before the later consolidation tickets relocate or merge coverage.

## Blocked by

None (can start immediately).

## Verified implementation scope

The strengthened F1 release assertion exposed an application defect during verification: after changing mode while an entity press remains held, inspection stays cancelled before release, but a later release can select the entity and reopen Inspector. The affected canvas code is unchanged from the implementation baseline. This ticket includes a narrow gesture-cancellation correction so the cancelled press cannot become an entity activation when released. Preserve activation by a fresh press, existing pointer/touch cancellation ownership, and committed workspace data. Keep the assertion that exposed this behavior; verify the correction and adjacent gesture variants before closure.

## Acceptance criteria

- [x] F1: start from Navigate or Move, establish a qualifying held entity press that can arm inspection, and perform an actual mode change. Assert cancellation and the eventual release outcome; retain a positive companion proving the gesture can activate.
- [x] F2: establish and assert the requested mode separately before the Object and Orbit portions of every claimed palette-mode variant, accounting for the mode reset after creation.
- [x] F3: seed distinguishable invalid current and backup records, reject restoration, and assert preservation of both records so an accidental replacement is observable.
- [x] F4: capture observer observations and assert them outside the best-effort callback whose exceptions production intentionally catches. Preserve the separate deliberate observer-error case and durable acknowledgement checks.
- [x] F5: capture the camera immediately before Pan-right and assert the intended displacement. Inspect the related wheel/pre-button baseline and hardcoded identity comparisons, correcting the same weakness where present.
- [x] Demonstrate sensitivity to each specified regression using a controlled negative case or temporary local fault where necessary. Record the failing observation, restore the candidate, and retain only appropriate regression coverage.
- [x] Preserve the upstream delivered-input Orbit resize correction (F9), exact domain/persistence equality, real native input where required, and justified CSS-pixel rendering tolerances.
- [x] Run the affected scenarios and surrounding variants without retries. Record results and any newly exposed product defect; scope a product change explicitly rather than weakening the assertion.

## Planning baseline

Approved ticket breakdown: 2026-10-30. Planning baseline: `971e91c0ad2fc78e4f92c1e625091a577960b41b`, matching fetched `origin/main` when this effort was planned. The original audit used an older revision; its execution results are historical evidence only. Record the actual implementation baseline and reconcile intervening changes before relying on the inventory or prior results.

## Resolution

Implemented and independently reviewed against the intentionally retained implementation baseline `956ead47f931bb9f77b0949746757fcafe491822`. All five named assertion defects now have successful normal checks and observed negative controls; the newly exposed release-activation defect has the bounded correction described above. The targeted browser cases passed 8/8 and adjacent gesture variants passed 10/10, with zero retries. The changed cases also passed in the complete run. Lint, typecheck and production build passed.

The complete suite remains red at 435/460 passes, with 25 recorded failures and a subsequent diagnostic teardown failure tracked in ticket 02. Closing this ticket records its corrected assertions and scoped product behavior; it does not claim complete-suite stability. See [Tickets 02 and 03 implementation evidence](../implementation-02-03-results.md) for candidate identities, commands, restored faults and remaining limits.
