async page => {
  await page.evaluate(async () => {
    const api = window.reportAuthoring;
    if (!api || !api.report) {
      throw new Error("window.reportAuthoring.report is not available.");
    }

    const { report, helpers } = api;
    await helpers.waitForReady();

    // Replace these placeholders with real semantic-model objects from the
    // report you are authoring before running the sample.
    const pageName = "Executive Summary";
    const measureTable = "_Measures";
    const salesTable = "Sales";
    const productTable = "Products";
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

    const addTitle = async (visual, title) => {
      await visual.setProperty({ objectName: "title", propertyName: "visible" }, helpers.property(true));
      await visual.setProperty({ objectName: "title", propertyName: "titleText" }, helpers.property(title));
    };

    const visuals = [
      {
        visualType: "card",
        layout: { x: 24, y: 24, width: 260, height: 120, z: 0 },
        bind: async visual => {
          await helpers.addFirstMatchingRole(
            visual,
            ["Values", "Y"],
            helpers.measure(measureTable, "Total Revenue")
          );
          await addTitle(visual, "Total Revenue");
        }
      },
      {
        visualType: "card",
        layout: { x: 308, y: 24, width: 260, height: 120, z: 0 },
        bind: async visual => {
          await helpers.addFirstMatchingRole(
            visual,
            ["Values", "Y"],
            helpers.measure(measureTable, "Gross Margin")
          );
          await addTitle(visual, "Gross Margin");
        }
      },
      {
        visualType: "slicer",
        layout: { x: 592, y: 24, width: 260, height: 120, z: 0 },
        bind: async visual => {
          await helpers.addFirstMatchingRole(
            visual,
            ["Category", "Values", "Field"],
            helpers.column(productTable, "Category")
          );
          await addTitle(visual, "Category");
        }
      },
      {
        visualType: "clusteredColumnChart",
        layout: { x: 876, y: 24, width: 260, height: 120, z: 0 },
        bind: async visual => {
          await helpers.addFirstMatchingRole(
            visual,
            ["Category", "Axis", "SharedAxis"],
            helpers.column(salesTable, "Region")
          );
          await helpers.addFirstMatchingRole(
            visual,
            ["Y", "Values", "Measure"],
            helpers.measure(measureTable, "Total Revenue")
          );
          await addTitle(visual, "Revenue by Region");
        }
      },
      {
        visualType: "barChart",
        layout: { x: 24, y: 176, width: 556, height: 260, z: 0 },
        bind: async visual => {
          await helpers.addFirstMatchingRole(
            visual,
            ["Category", "Axis", "SharedAxis"],
            helpers.column(productTable, "Category")
          );
          await helpers.addFirstMatchingRole(
            visual,
            ["Y", "Values", "Measure"],
            helpers.measure(measureTable, "Gross Margin")
          );
          await addTitle(visual, "Gross Margin by Category");
        }
      },
      {
        visualType: "tableEx",
        layout: { x: 604, y: 176, width: 532, height: 260, z: 0 },
        bind: async visual => {
          const rows = [
            helpers.column(productTable, "Product Name"),
            helpers.column(productTable, "Category"),
            helpers.column(salesTable, "Region"),
            helpers.measure(measureTable, "Total Revenue"),
            helpers.measure(measureTable, "Gross Margin")
          ];

          for (const field of rows) {
            await helpers.addFirstMatchingRole(visual, ["Values", "Rows", "Category"], field);
          }

          await addTitle(visual, "Product Detail");
        }
      }
    ];

    for (const definition of visuals) {
      const response = await targetPage.createVisual(definition.visualType, definition.layout, false);
      const visual = response.visual;
      await helpers.showVisual(targetPage, visual);
      await definition.bind(visual);
    }

    await report.save();
  });
}
