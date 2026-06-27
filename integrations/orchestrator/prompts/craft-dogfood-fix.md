The live-dogfood gate denied the change: the assembled application did not actually run
the change end-to-end (it failed to launch or render, crashed on the path the change
touches, or ran but did not exhibit the feature the work item asked for). Fix it, then
stop.

- Make the change real in the RUNNING application, not just in the tests. If the app
  crashed or hung on startup or on the changed path, fix the failure (a dependency or
  resource that is not wired, a null the real run hits that the test does not, a missing
  registration). If the feature was missing, blank, placeholder, or inert at runtime,
  wire it so it actually appears and works when the app runs.
- Reproduce the gate's run yourself: launch the app the same headless/demo way the gate
  did, drive it to the surface the work item changed, and confirm the change is visibly
  present and working before you finish.
- Keep the build and the full test suite green. The gate will re-run the app after you
  finish; a fix that breaks verification or still does not show at runtime is not a fix.
- Address what was flagged plus anything tightly coupled that the same gap would also
  break. Do not start unrelated rework.

Branch discipline: commit your fix directly on the CURRENT branch. Do NOT create or
switch branches, push, or open a pull request. Commit and stop.
