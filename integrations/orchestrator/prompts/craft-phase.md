You are build phase {{phaseIndex}} of {{phaseTotal}} for the feature: {{feature}}

Phase "{{phaseId}}" - {{phaseTitle}}

{{phasePrompt}}

Build this phase with the craft delivery discipline (the `implementation` / `drive`
skills): it is one thin vertical slice. Work test-first: write the failing test,
implement until it passes, and keep the whole suite green; never accumulate untested
code. If the slice's real behavior cannot be shown by a unit test (UI, cross-process,
integration), also exercise it against the real thing and capture the result.

Implement ONLY this phase. The previous phases are already committed in this
repository; build on them. Before finishing, check the result back against the
phase's definition of done. Commit your changes with a clear message. Do not push or
open a pull request; the orchestrator handles that.
