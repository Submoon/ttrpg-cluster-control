---
title: 'Open and recover the real local workspace at the product root'
status: closed
type: implementation
label: wayfinder:implementation
parent: ../spec.md
triage_labels:
  - enhancement
  - ready-for-agent
---

# 18: Open and recover the real local workspace at the product root

## Scope

Stories 1–3 and 101–102; cross-cutting checks 89, 98, 107–111, 119–120. Families B1, B8, B9. Implement the real product-root workspace creation, resume, and validated recovery against the [specification](../spec.md#user-stories).

## Resolution

Completed 2026-10-19 at source candidate 06997ef73fe9f722f458f491b50dafab32d9c6a7, using presentation candidate 86b5ab64. The real workspace/storage owner and schema remain authoritative; Nuxt UI Welcome, loading, and recovery surfaces correct clipped actions and focus contrast. Typecheck and the corrected build pass; focused development checks pass 9/9 and compiled launch/recovery checks pass 8/8. Bounded presentation checks cover four viewports in both themes; sampled contrast minima are text 5.7401:1, controls 5.5869:1, and focus 6.1266:1.

The only full-suite attempt is 0 passed / 1 failed / 92 not run at an unclassified cluster-return failure, with six pre-existing local test edits excluded from the candidate. This is not a whole-product certificate. Physical Android Chrome checks remain unavailable. The [original QA record at cleanup baseline](https://github.com/Submoon/ttrpg-cluster-control/blob/cf469857862565c58047fee98f8f174bee845c7c/.scratch/interface-revamp/implementation-lab/ticket-18-resume-2026-10-19/qa/final-summary.md) retains detailed runtime, browser, and source provenance.
