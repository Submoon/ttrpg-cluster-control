# Interface revamp specification handoff

## Outcome

The human explicitly requested consolidation of the remaining Dock/Tools records followed by coordinated to-spec subagents. The [specification](../spec.md) is complete, locally `open` with `triage_labels: enhancement, ready-for-agent`. The [map](../map.md) and all seventeen decision/investigation tickets are closed with bounded Resolutions. Readiness means specified and planned, not implemented or physically accepted.

The specification carries the whole saved-workspace refactor, every retained capability, accepted B/Dock/Fields/Inspector contracts, maximum Nuxt UI reuse and mandatory integration corrections. The [current Astra review](astra-current-interface-review-2026-10-16.md) supplies whole-interface feedback; it is distinct from the new specification reviews below.

## Baseline and authority

Fresh origin fetch and source-request read on 2026-10-16 establish intentional feature baseline `52b3e7aa2946824826ec41071b0d530cc88f38ed`, matching its remote and 0 main-only / 22 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. [Revamp the interface](https://github.com/Submoon/ttrpg-cluster-control/issues/3) remains unchanged and open, with `enhancement`, `priority:P1`, and no comments. Later documentation commits do not change this recorded intake.

Human decisions during this handoff:

- Existing Dock preference and accepted artifacts resolve presentation without another comparison vote. Known defects/unverified gates transfer explicitly to implementation criteria rather than becoming pass claims.
- The human confirms automated Playwright desktop and mobile-emulated portrait/landscape/touch journeys, with targeted phone checks for OS keyboard and physical gestures. The [test-seam investigation](spec-test-seams-2026-10-16.md) records actual existing seams and prior art.
- The human then explicitly limits Android support to **Chrome**. Earlier Android/Firefox observations remain historical evidence, not a Firefox repair gate or proof of Chrome failure/success. General keyboard-open action reachability, landscape and gesture guarantees now target Chrome. This does not mandate a new connected-device CI harness or add WebView product scope.

## Delegation and independent reviews

All analysis/document specialists used **SOL 6.1 High**, as requested. No code implementation was delegated or performed; Luna XHIGH remains the requested model for subsequent implementation.

| Role | Ownership and outcome |
| --- | --- |
| `interface_spec_synthesis` | Owned only the complete specification. Synthesized all seventeen Resolutions, source capability matrix, current evidence, acceptance obligations and human browser/test decisions; 120 sequential user stories and required to-spec sections. |
| `spec_test_seams` | Owned the test-seam report, then independently reviewed the frozen specification for technical consistency/testability. Confirmed one P2 ambiguity: cancellation/failure wording did not explicitly distinguish pre-application refusal from post-application durable failure. |
| `spec_domain_preservation_review` | Independently reviewed all decision Resolutions, capability/domain/data contracts and relevant source. Initial review found no confirmed blocker; correction review verifies the applied-versus-durable, identity and scope boundaries. |
| Coordinator | Owned map/ticket/README integration, human confirmation, adjudication, document checks and Git/PR publication. |

Initial frozen specification: SHA-256 `CC97ACFF428B4078B8FF1CAA4DD5E0E1D798E3EAD540F29453E8D1D997CE1D38`. The author corrected the confirmed P2 and three coordinator clarifications: durable theme preference is explicitly allowed while map/tool/selection/drafts stay temporary; supported older schema shapes do not introduce previous-marker fallback; post-deletion stale-UI cleanup does not absorb the separate defaults-generator fix. Only six clauses changed. Both independent correction reviews report **no remaining findings/blockers**.

Final frozen specification: 381 lines; SHA-256 `DF58B9D8715140A8F18D9F808FF83A2B1EBEC3F2596A2B23F37F1E51778E212F`. Reviews were read-only; no runtime, browser or application-test pass is claimed. Coordinator documentation validation checks local links, required sections/frontmatter, sequential story numbering, one Resolution per closed decision and whitespace. No app source, package, schema, glossary or ADR changes are included.

## Next boundary and retained limits

Use **to-tickets** against the specification for self-contained vertical implementation slices and explicit blockers before implementation. Do not promote the disposable default route or simulation into the saved-workspace product. Tests must target the real integrated persisted editor; historical suites navigating `/` are preservation prior art, not a passing current gate. The actual baseline still needs presentation-independent drafts, full Apply/Discard/Stay, memory-first acknowledgement and real latest-snapshot Retry; export must satisfy applied-only content, palette and transient-free bounds.

Mandatory work includes menu layering, compact Fields/Add chrome, supported-Chrome keyboard/landscape/physical-gesture checks, usable map area, full Inspector parity, local icons/common persisted themes, accessible controls/contrast/focus, real ordered persistence/recovery, clean full-scene SVG/PNG and final performance measurements. No exact final numerical performance budget was agreed. Historical test results retain source identities, and known gaps are not silently marked passed.

No implementation tickets, source-issue comments/labels/closure, product implementation or merge are included. Existing draft PR publication remains the authorized document/preview channel.
