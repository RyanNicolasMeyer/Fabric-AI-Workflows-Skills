# Iterative Authoring and QA Loop

## Standard loop

1. Generate `session-config.js`.
2. Start the local helper host through the companion CLI.
3. Open the edit helper in a headed Playwright browser.
4. Run the build script against the live embedded report object. The runtime should re-enter the edit helper automatically before executing the script.
5. Save the report.
6. Open the view helper.
7. Navigate to the target page.
8. Capture screenshots and snapshots.
9. Review for clipping, overlap, readability, spacing, slicer behavior, and visual hierarchy.
10. Revise the build script or helper runtime.
11. Repeat until clean.

## Validation rule

Validation happens in **view mode**, not only in edit mode.

That means:

- page navigation must work
- visuals must render without edit chrome
- labels and titles must fit
- slicers must remain usable
- the visual hierarchy must hold up for a consumer, not only an author

## Required outputs from a test pass

- successful report save
- visible target page in the view helper
- screenshot artifact
- exported report artifact

## Completion bar

Treat the loop as complete only when:

- the build script can be rerun without manual cleanup
- the wrapper pages expose stable globals consistently
- the screenshots are visually clean
- the exported artifact exists locally
