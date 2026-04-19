# Embedded Authoring Guardrails

## What this pattern does well

- create or rebuild report pages repeatably
- create and delete visuals deterministically
- bind fields programmatically
- run a tight screenshot-driven QA loop
- save the live report and export the result

## What this pattern does not replace

- semantic-model authoring
- Power Query work
- rich Desktop-only formatting flows
- every nuance of the Power BI format pane

## Gotchas to preserve

- Visual creation APIs only work after the report is rendered.
- Some page mutations only work reliably on the active page.
- New visuals may need explicit display-state handling before they appear correctly.
- The correct role names vary by visual type. Use `getCapabilities()` instead of guessing.
- A report that looks acceptable in edit mode can still be wrong in view mode.
- A real saved Fabric report item is needed before the embedded loop is fully useful.
- The helper app is not “just open Power BI in a browser.” It is a custom wrapper page that exposes the embedded report object for scripted mutation.

## Switching methods

Switch away from this pattern when:

- the change is tiny and easier in direct PBIR
- the task is mostly manual formatting
- the task is actually about the semantic model, not the report
