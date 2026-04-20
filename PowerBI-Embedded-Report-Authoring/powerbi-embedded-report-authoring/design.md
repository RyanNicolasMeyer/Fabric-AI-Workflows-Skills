# Dashboard Design Guide

Use this file as the editable visual standard for dashboard-style Power BI reports authored through the embedded-authoring skill.

Keep `SKILL.md` focused on workflow and runtime behavior. Change this file when the expected look-and-feel should evolve.

## Default style

Use a clean executive-dashboard treatment by default:

- Prefer a `1280x720` canvas for single-page executive dashboards unless the target report already follows a different page standard.
- Use a light neutral page background or wallpaper instead of a plain white canvas.
- Favor white visual tiles against the neutral page background.
- Keep outer margins and gutters even across the full page.
- Reserve a compact top band for title, context text, and compact controls.

## Layout rhythm

Use a strong Z-pattern:

- Top band: header, compact context text, dropdown slicers, and KPI strip.
- Middle band: comparison and trend visuals aligned to a deliberate grid.
- Bottom band: a readable detail table or matrix that feels like a footer section, not an afterthought.

For executive dashboards:

- Avoid oversized empty gaps.
- Avoid uneven tile widths or drifting vertical alignment.
- Keep edges aligned across rows.
- Prefer a small number of well-sized visuals over many cramped visuals.

## Header and slicers

- Use a strong page title with visible hierarchy over any subtitle or helper text.
- Keep the header compact so the report still prioritizes data.
- Use dropdown slicers by default unless list selection is materially better.
- Hide slicer headers when placement or nearby text already makes the slicer purpose obvious.
- Keep slicers grouped and visually balanced with the header instead of scattering them across the page.

## KPI treatment

- Prefer one KPI strip or a visually unified KPI row over disconnected cards.
- Keep KPI labels short and business-readable.
- Suppress extra label clutter where possible.
- Treat KPI cards as summary signals, not mini charts.

## Visual tiles

- Use consistent white tile backgrounds over the neutral canvas.
- Keep title styles consistent across visual tiles.
- Match heights within the same row whenever possible.
- Use charts that are easy to scan quickly: bars, columns, lines, donuts, and a limited number of supporting visuals.
- Do not force a visual type that hurts clarity just for variety.

## Detail section

- Prefer a matrix or pivot-style detail view when it reads better than a flat table.
- Give the detail view enough width and height to be readable without crowding.
- Keep it visually connected to the rest of the dashboard through the same tile treatment and spacing system.

## QA checklist

Validation must happen in view mode, not only in edit mode.

Before calling a dashboard finished, confirm:

- page background and tile contrast look intentional
- header placement and sizing feel balanced
- slicers are easy to use and not oversized
- KPI section reads as one coherent summary band
- visual titles and labels are not clipped
- axes, legends, and labels do not collide
- gutters and margins are consistent
- the bottom detail section is readable at normal viewing size
- the page looks designed, not merely populated
