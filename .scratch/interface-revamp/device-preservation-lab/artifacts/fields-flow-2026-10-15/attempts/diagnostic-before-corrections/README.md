# Diagnostic run — not acceptance evidence

This preserved browser run intentionally reproduces the initial candidate's behavior. Its case, `dirty-back-guard-preserves-edit`, encoded an incorrect acceptance expectation: it expected Back from a dirty editor to open a discard guard. The accepted flow requires Back to return to the list while retaining the draft. Treat this run only as diagnostic evidence for the initial implementation; its `passed` result does not mean the accepted Back behavior passed.
