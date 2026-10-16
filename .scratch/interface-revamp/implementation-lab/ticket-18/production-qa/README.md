# Ticket 18 compiled-production QA

Baseline: `3c660a6a2df6c37f392c998c36d72cec1ddbf938`. This directory owns only supplementary QA scripts and evidence. Runtime execution waits for the coordinator's explicit handoff because implementation owns Nuxt generated output and port 3100 until then.

Run `node .scratch/interface-revamp/implementation-lab/ticket-18/production-qa/check-production.mjs` after a successful candidate build and compiled server startup. Default URL is `http://127.0.0.1:3118`; override with `QA_BASE_URL`. The script uses fresh temporary Chromium contexts, real app creation and IndexedDB writes confined to those contexts. It does not touch personal browser storage.

Method: capture the HTTP SSR loading shell, then measure response/DOMContentLoaded/welcome readiness and save/map readiness with identical observable selectors for `/` and `/?variant=baseline` at 1440×900. These are same-candidate route-only samples, not source-before/after comparisons or library cost measurements. Repeat welcome/recovery checks at 390×844, 844×390 and 390×500, recording keyboard focus visibility, hit testing, horizontal overflow, resize draft preservation, and create/save/reload. Recovery fixture damage is deliberate and isolated; backup is a copy of the valid record produced by real creation.

Contrast evidence combines computed foreground/border/outline colors with actual rendered background pixels sampled from a text-transparent screenshot. This incorporates body gradients, panel backgrounds and transparent controls. Text uses 4.5:1; meaningful control boundaries and focus use 3:1. Sampling is bounded to changed welcome/recovery surfaces, not product-wide accessibility certification. Screenshots support manual inspection.

Current dark theme only; light is ticket 19. Chromium touch emulation does not establish Android Chrome physical keyboard, safe-area, gesture or device behavior. Those checks remain unavailable without a physical device. No new device harness is introduced.
