---
name: uiux-design
description: 'Produce the UI/UX design half of an application spec: research incumbent UX, design user jobs and flows, a screen inventory, an interaction model, wireframe-level layout, a visual design system, and accessibility, competitive with the best-in-class for the app type. Canonical output is a tool-agnostic design spec; renders to Figma when the host allows it. Use for: design the UX, design the UI, user flows, wireframes, screen inventory, interaction model, design system, visual design, accessibility, make this usable, how should this look, UX competitive analysis, design the experience. NOT for: the feature surface (see product-spec), spec section structure (see writing-spec), prose voice (see writing-documentation), code-level theming.'
---

# UI/UX design (well-designed and competitive)

Produce the **design half** of an application spec: how the app is used and how it looks, at a quality
bar of **well-designed and competitive with the best-in-class for the app type**. This skill owns the
experience; its peer `product-spec` owns the feature surface. The reason it exists: a feature-complete
plan with no design ships a **barely-usable first pass**, because the experience gets improvised at
the keyboard. A real design, made before the code, is what closes that gap.

The canonical artifact is a **tool-agnostic design spec** (flows, wireframes, tokens, accessibility),
so the design is reviewable and host-independent. When the session runs under a host that can reach a
design tool (Figma via its MCP), the same design is also **rendered to the canvas** and the spec links
those frames. The design tool is a fidelity upgrade, never a dependency.

**Skip-gate:** this is for application-scale work. A single screen or a minor UI tweak does not need a
full design pass; sketch the change, note the interaction, and build it.

## Stage 1 - Bench the incumbents' UX

Competitiveness on experience is earned the same way as on features: by grounding in the real
category. Use the `research` skill.

- For each best-in-class incumbent (reuse the list the `product-spec` skill already found), name **what
  its experience is known for**: the core flow, the interaction style, what reviewers praise or hate.
- Capture the **UX table stakes** of the category (the interactions a credible entrant must have) and
  the **experience differentiators** (where incumbents compete on feel, speed, or clarity).
- Quote and cite, do not recall. A UX claim about a competitor that you did not verify is a hypothesis.

## Stage 2 - User jobs and flows

Start from what the user is trying to get done, not from screens.

- Name the **primary user and their top jobs** in a sentence each (the Mom Test: their real task, not
  a feature). These are what the design must make fast.
- Design the **key flows** as step sequences, the riskiest or highest-traffic first. Express each as a
  Mermaid flowchart so a reviewer sees the path before the pixels.
- A flow that needs a feature the `product-spec` did not list is a **reconciliation signal**: hand it
  back to `product-spec` rather than inventing the feature inside the design.

## Stage 3 - Screen inventory and interaction model

- **Screen / surface inventory:** list every screen, panel, or surface, with its purpose in a clause.
  This is the design's equivalent of the feature surface, it must cover every flow.
- **Interaction model:** state the spine of how the user drives the app (keyboard-first vs pointer,
  primary navigation, selection, the empty / loading / error states each surface must handle). Name it
  explicitly; an unstated interaction model is where usability quietly rots.

## Stage 4 - Wireframe the key surfaces

Design at **wireframe / layout fidelity**, not pixel-perfect mockups. Enough that a build is usable on
the first pass and a reviewer can judge the experience.

- For each key surface, lay out the regions and the primary controls. In the tool-agnostic spec, use
  labelled ASCII / box-drawing wireframes (regions, lists, primary actions, focus order).
- Show the important **states** (empty, loading, error, populated) for surfaces where they differ,
  using a Mermaid `stateDiagram` or per-state wireframes.
- When a Figma-capable host is available, render these surfaces as Figma frames and link them; the
  ASCII wireframes remain the canonical, reviewable source.

## Stage 5 - Visual design system and accessibility

- **Design system / tokens:** define the visual language as named tokens, color roles, type scale,
  spacing, and the core component set (button, input, list row, panel). Text tokens are canonical;
  they map to Figma variables when rendered. A design system, not a pile of one-off styles, is what
  makes the build coherent.
- **Accessibility:** state the keyboard model (every action reachable without a pointer), focus order
  and visibility, color-contrast intent, and screen-reader expectations. Accessibility is part of the
  competitive bar, not a later pass; many incumbents win or lose here.

## Stage 6 - Emit the design spec

Emit the design half of the spec using the `writing-spec` structure and run `writing-documentation` on
the prose. Every UX parity claim carries its source. The spec contains the flows, the screen
inventory, the wireframes, the design system, and the accessibility model; it links the Figma frames
when they exist. Compose with the `product-spec` output into one combined spec.

## Host note: Figma is optional, not required

The design renders to **Figma via the Figma MCP server** for higher fidelity and designer round-trip,
but Figma's remote server only accepts allowlisted MCP clients (Claude Code, Cursor, VS Code); a host
that is not allowlisted (Copilot CLI today) cannot reach it. So the **tool-agnostic design spec is
always the canonical artifact**, and the Figma render is an upgrade taken only when the host allows it.
Run the UI/UX agent under Claude Code when designer-grade Figma output and round-trip are wanted.

## End state

A design a reviewer can trust on two axes at once: **well-designed**, because the flows, screens,
wireframes, design system, and accessibility model together describe a usable experience rather than a
feature list, and **competitive**, because the incumbents' UX is benched and the design matches or
beats them on a named axis. The whole design lives in the tool-agnostic spec, so it is reviewable
anywhere, and renders to Figma when the host can. A build can come out of it usable on the first pass.
