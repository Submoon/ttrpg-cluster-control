# Triage labels

`/triage` assigns one category role and one state role to each triaged ticket.

| Role | Local value | Meaning |
| --- | --- | --- |
| Category: `bug` | `bug` | Something is broken |
| Category: `enhancement` | `enhancement` | A new feature or improvement |
| State: `needs-triage` | `needs-triage` | Maintainer needs to evaluate the ticket |
| State: `needs-info` | `needs-info` | Waiting for more information |
| State: `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an agent |
| State: `ready-for-human` | `ready-for-human` | Requires human implementation |
| State: `wontfix` | `wontfix` | Will not be actioned |

Store these values in the ticket's `triage_labels` YAML list; omit the field until triage has assigned both roles. Keep this list separate from lifecycle `status` and the Wayfinder `label` field.
