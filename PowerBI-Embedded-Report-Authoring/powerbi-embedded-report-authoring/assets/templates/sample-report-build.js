async page => {
  await page.evaluate(async () => {
    const api = window.reportAuthoring;
    if (!api || !api.report) {
      throw new Error("window.reportAuthoring.report is not available.");
    }

    const { report, helpers } = api;
    await helpers.waitForReady();

    // Replace these placeholders with real page, table, and measure names
    // from the target semantic model before running the script.
    const pageName = "Executive Summary";
    const measureTable = "_Measures";
    const primaryMeasure = "Total Revenue";

    let targetPage = await helpers.findPageByDisplayName(pageName);
    if (!targetPage) {
      if (typeof report.addPage !== "function") {
        throw new Error("The embedded report does not expose addPage().");
      }

      await report.addPage(pageName);
      targetPage = await helpers.findPageByDisplayName(pageName);
    }

    if (!targetPage) {
      throw new Error(`Unable to create or locate page '${pageName}'.`);
    }

    await targetPage.setActive();
    await helpers.clearPage(targetPage);

    const response = await targetPage.createVisual("card", { x: 40, y: 40, width: 240, height: 120, z: 0 }, false);
    const visual = response.visual;

    await helpers.showVisual(targetPage, visual);
    await helpers.addFirstMatchingRole(
      visual,
      ["Values", "Y"],
      helpers.measure(measureTable, primaryMeasure)
    );

    await visual.setProperty({ objectName: "title", propertyName: "visible" }, helpers.property(true));
    await visual.setProperty({ objectName: "title", propertyName: "titleText" }, helpers.property(primaryMeasure));

    await report.save();
  });
}
