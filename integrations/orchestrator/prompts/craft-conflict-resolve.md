The branch built and passed review, but it no longer merges cleanly into the base branch because
another change landed first. Resolve the listed merge conflicts on the CURRENT branch so the branch
merges cleanly, then commit the merge. Do NOT redo the feature; only reconcile it with the base.

The base has already been merged into this branch and the merge is paused on conflicts. For each
conflicted file:

- Open it and read every conflict region (the `<<<<<<<` / `=======` / `>>>>>>>` markers, and the
  `|||||||` base section when present).
- COMBINE both sides so both changes keep working. These are two independent features that touched the
  same place; the goal is to keep both, not to pick one. When two changes add a parameter, a field, an
  event subscription, or a list entry, keep BOTH. When they add to a constructor call or signature,
  include every parameter from both sides in a consistent order.
- Favor the base's STRUCTURE where the two genuinely collide on the same line (the base is what the rest
  of the tree now expects), but preserve this branch's behavior on top of it.
- Remove every conflict marker. Do not leave a `<<<<<<<`, `=======`, `|||||||`, or `>>>>>>>` behind.

Then make it green and commit:

- Build and run the full test suite; fix any compile or test breakage the merge introduced (a combined
  signature the callers must match, a field both sides assigned, a renamed symbol). Keep warnings-as-
  errors clean and do not introduce em dashes in code or user-facing strings.
- Stage all resolved files and commit the in-progress merge on the CURRENT branch (`git commit` with no
  conflicts remaining). Do NOT create or switch branches, do NOT push, and do NOT open or complete a
  pull request. The orchestrator verifies the result and completes the merge.

Definition of done: no conflict markers remain, the merge is committed on the current branch, and the
build and full test suite are green.
