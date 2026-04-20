/**
 * Post-authoring style transform for apply-style.
 *
 * apply-style exports the live Fabric report as PBIR, invokes this function
 * against the on-disk report definition, then imports the patched definition
 * back. Use this to apply formatting the embedded-authoring SDK cannot reach
 * via setProperty (titles, tile backgrounds, dropdown slicer mode, textbox
 * paragraphs, etc.).
 *
 * The StyleContext gives you:
 *   - reportRootDir:      absolute path to the exported report folder
 *   - readJson(rel):      read a JSON file relative to reportRootDir
 *   - writeJson(rel, v):  write a JSON file relative to reportRootDir
 *   - listVisualFiles():  every visual.json under the report
 *   - listPageFiles():    every page.json under the report
 *
 * PBIR layout (illustrative):
 *   <report>.Report/
 *     definition/
 *       pages/
 *         <page>/
 *           page.json
 *           visuals/
 *             <visual>/
 *               visual.json
 *
 * This example sets tile backgrounds to white and forces slicer mode to Dropdown
 * on every visual. Adjust for your own palette and layout.
 */

const path = require("node:path");
const fs = require("node:fs/promises");

const PALETTE = {
  page: "#F3F2F1",
  tile: "#FFFFFF",
  text: "#252423",
  subtext: "#605E5C"
};

module.exports = async function applyStyle(ctx) {
  const visualFiles = await ctx.listVisualFiles();
  for (const absPath of visualFiles) {
    const raw = await fs.readFile(absPath, "utf8");
    const doc = JSON.parse(raw);
    const visualType = doc?.visual?.visualType;
    if (!visualType) continue;

    doc.visual = doc.visual || {};
    doc.visual.objects = doc.visual.objects || {};
    const objects = doc.visual.objects;

    objects.background = objects.background || [{}];
    objects.background[0].properties = objects.background[0].properties || {};
    objects.background[0].properties.show = { expr: { Literal: { Value: "true" } } };
    objects.background[0].properties.color = {
      solid: { color: { expr: { Literal: { Value: `'${PALETTE.tile}'` } } } }
    };

    if (visualType === "slicer") {
      objects.data = objects.data || [{}];
      objects.data[0].properties = objects.data[0].properties || {};
      objects.data[0].properties.mode = { expr: { Literal: { Value: "'Dropdown'" } } };
    }

    await fs.writeFile(absPath, JSON.stringify(doc, null, 2), "utf8");
  }

  const pageFiles = await ctx.listPageFiles();
  for (const absPath of pageFiles) {
    const raw = await fs.readFile(absPath, "utf8");
    const doc = JSON.parse(raw);
    doc.objects = doc.objects || {};
    doc.objects.background = doc.objects.background || [{}];
    doc.objects.background[0].properties = doc.objects.background[0].properties || {};
    doc.objects.background[0].properties.color = {
      solid: { color: { expr: { Literal: { Value: `'${PALETTE.page}'` } } } }
    };
    await fs.writeFile(absPath, JSON.stringify(doc, null, 2), "utf8");
  }

  // Avoid unused-variable warning for path; keep the import in case callers want it.
  void path;
};
