# Triage labels

`/triage` assigns one category role and one state role to each triaged request.

| Role | GitHub label / local value | Meaning |
| --- | --- | --- |
| Category: `bug` | `bug` | Something is broken |
| Category: `enhancement` | `enhancement` | A new feature or improvement |
| State: `needs-triage` | `needs-triage` | Maintainer needs to evaluate the ticket |
| State: `needs-info` | `needs-info` | Waiting for more information |
| State: `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an agent |
| State: `ready-for-human` | `ready-for-human` | Requires human implementation |
| State: `wontfix` | `wontfix` | Will not be actioned |

For GitHub requests, apply these roles as issue labels. Replace conflicting labels from the same role group while preserving unrelated labels, including `idea` and `priority:P1/P2/P3`. Create missing labels only when needed and with approval for the remote write.

For local tickets, store the roles in the `triage_labels` YAML list; omit the field until triage has assigned both roles. Keep this list separate from lifecycle `status` and the Wayfinder `label` field. GitHub open/closed state and local lifecycle status are not triage roles.
