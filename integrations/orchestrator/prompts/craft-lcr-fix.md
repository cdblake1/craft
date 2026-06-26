The code-review gate denied the change. Address the review findings below, then stop.

- Fix every blocking/must-fix finding the gate raised. Make the change correct: fix the
  bug, add or repair the missing test, honor the contract, resolve the defect.
- Keep the build and the full test suite green. The gate will re-review after you
  finish; a fix that breaks verification is not a fix.
- Address what was flagged plus anything tightly coupled to it that the same defect
  class would also break. Do not start unrelated rework.

Branch discipline: commit your fix directly on the CURRENT branch. Do NOT create or
switch branches, push, or open a pull request. Commit and stop.
