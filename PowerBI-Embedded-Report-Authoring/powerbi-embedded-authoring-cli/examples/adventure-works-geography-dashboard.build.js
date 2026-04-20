async page => {
  await page.evaluate(async () => {
    const api = window.reportAuthoring;
    if (!api || !api.report) {
      throw new Error("window.reportAuthoring.report is not available.");
    }

    const { report, helpers, models } = api;
    await helpers.waitForReady();

    const pageName = "Geography Executive Dashboard";
    const salesTable = "Sales";
    const territoryTable = "Sales Territory";
    const productTable = "Product";
    const dateTable = "Date";
    const salesOrderTable = "Sales Order";

    const palette = {
      page: "#F3F2F1",
      tile: "#FFFFFF",
      text: "#252423",
      subtext: "#605E5C",
      border: "#D2D0CE"
    };

    const canvas = {
      width: 1280,
      height: 720
    };

    const availableVisualTypes =
      typeof report.getAvailableVisualTypes === "function"
        ? await report.getAvailableVisualTypes()
        : [];

    const hasVisual = visualType =>
      availableVisualTypes.length === 0 || availableVisualTypes.includes(visualType);

    const requiredVisuals = ["textbox", "slicer", "clusteredBarChart", "lineChart", "donutChart"];
    const missingRequiredVisuals = requiredVisuals.filter(visualType => !hasVisual(visualType));
    if (missingRequiredVisuals.length > 0) {
      throw new Error(
        "The embedded authoring API does not expose required visual types for the template-style layout: " +
          missingRequiredVisuals.join(", ")
      );
    }

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
    if (typeof targetPage.resizePage === "function") {
      await targetPage.resizePage(models.PageSizeType.Custom, canvas.width, canvas.height);
    }
    await helpers.clearPage(targetPage);

    const safeSetProperty = async (visual, selector, value) => {
      try {
        await visual.setProperty(selector, helpers.property(value));
      } catch (error) {
        console.warn(
          "Unable to apply visual property.",
          selector.objectName + "." + selector.propertyName,
          error
        );
      }
    };

    const setTitle = async (visual, title) => {
      await safeSetProperty(visual, { objectName: "title", propertyName: "visible" }, true);
      await safeSetProperty(visual, { objectName: "title", propertyName: "titleText" }, title);
    };

    const hideTitle = async visual => {
      await safeSetProperty(visual, { objectName: "title", propertyName: "visible" }, false);
    };

    const setBackground = async (visual, color) => {
      await safeSetProperty(visual, { objectName: "background", propertyName: "show" }, true);
      await safeSetProperty(
        visual,
        { objectName: "background", propertyName: "color" },
        { solid: { color } }
      );
      await safeSetProperty(visual, { objectName: "background", propertyName: "transparency" }, 0);
    };

    const hideBackground = async visual => {
      await safeSetProperty(visual, { objectName: "background", propertyName: "show" }, false);
    };

    const setTextboxParagraphs = async (visual, paragraphs) => {
      await safeSetProperty(visual, { objectName: "general", propertyName: "paragraphs" }, paragraphs);
    };

    const styleTile = async visual => {
      await setBackground(visual, palette.tile);
    };

    const styleDropdownSlicer = async visual => {
      await hideTitle(visual);
      await safeSetProperty(visual, { objectName: "header", propertyName: "show" }, false);
      await safeSetProperty(visual, { objectName: "data", propertyName: "mode" }, "Dropdown");
      await setBackground(visual, palette.tile);
    };

    const createVisual = async (visualType, layout, bind, format) => {
      const response = await targetPage.createVisual(visualType, layout, false);
      const visual = response.visual;
      await helpers.showVisual(targetPage, visual);
      if (format) {
        await format(visual);
      }
      if (bind) {
        await bind(visual);
      }
      return visual;
    };

    const setDisplayName = async (visual, roleName, index, displayName) => {
      if (typeof visual.setDataFieldDisplayName !== "function") {
        return;
      }

      try {
        await visual.setDataFieldDisplayName(roleName, index, displayName);
      } catch (error) {
        console.warn("Unable to rename visual field.", roleName, index, displayName, error);
      }
    };

    const buildKpiStrip = async () => {
      if (hasVisual("cardVisual")) {
        const visual = await createVisual(
          "cardVisual",
          { x: 28, y: 84, width: 1224, height: 82, z: 200 },
          async currentVisual => {
            const roleName = await helpers.addFirstMatchingRole(
              currentVisual,
              ["Data", "Values", "Y"],
              helpers.column(salesTable, "Sales Amount")
            );
            await setDisplayName(currentVisual, roleName, 0, "Revenue");

            await currentVisual.addDataField(roleName, helpers.column(salesTable, "Total Product Cost"));
            await setDisplayName(currentVisual, roleName, 1, "Cost");

            await currentVisual.addDataField(roleName, helpers.column(salesTable, "Order Quantity"));
            await setDisplayName(currentVisual, roleName, 2, "Units");

            await currentVisual.addDataField(
              roleName,
              helpers.measure(salesTable, "Sales Amount by Due Date")
            );
            await setDisplayName(currentVisual, roleName, 3, "Due Date Revenue");
          },
          async currentVisual => {
            await hideTitle(currentVisual);
            await setBackground(currentVisual, palette.tile);
            await safeSetProperty(
              currentVisual,
              { objectName: "layout", propertyName: "backgroundShow" },
              false
            );
            await safeSetProperty(
              currentVisual,
              { objectName: "layout", propertyName: "paddingUniform" },
              0
            );
            await safeSetProperty(currentVisual, { objectName: "fillCustom", propertyName: "show" }, true);
            await safeSetProperty(currentVisual, { objectName: "divider", propertyName: "show" }, true);
            await safeSetProperty(currentVisual, { objectName: "outline", propertyName: "show" }, true);
            await safeSetProperty(currentVisual, { objectName: "accentBar", propertyName: "show" }, true);
          }
        );

        return [visual];
      }

      const cards = [
        {
          title: "Revenue",
          field: helpers.column(salesTable, "Sales Amount")
        },
        {
          title: "Cost",
          field: helpers.column(salesTable, "Total Product Cost")
        },
        {
          title: "Units",
          field: helpers.column(salesTable, "Order Quantity")
        },
        {
          title: "Due Date Revenue",
          field: helpers.measure(salesTable, "Sales Amount by Due Date")
        }
      ];

      const createdCards = [];
      for (const [index, card] of cards.entries()) {
        const visual = await createVisual(
          "card",
          { x: 28 + index * 311, y: 84, width: 291, height: 82, z: 200 },
          async currentVisual => {
            await helpers.addFirstMatchingRole(currentVisual, ["Values", "Y"], card.field);
            await hideTitle(currentVisual);
            await safeSetProperty(
              currentVisual,
              { objectName: "categoryLabels", propertyName: "show" },
              false
            );
            await safeSetProperty(
              currentVisual,
              { objectName: "labels", propertyName: "show" },
              true
            );
          },
          styleTile
        );

        await setTitle(visual, card.title);
        createdCards.push(visual);
      }

      return createdCards;
    };

    await createVisual(
      "textbox",
      { x: 0, y: 0, width: canvas.width, height: canvas.height, z: 0 },
      async visual => {
        await hideTitle(visual);
        await setTextboxParagraphs(visual, [
          {
            textRuns: [
              {
                value: " "
              }
            ]
          }
        ]);
      },
      async visual => {
        await setBackground(visual, palette.page);
      }
    );

    await createVisual(
      "textbox",
      { x: 28, y: 18, width: 500, height: 34, z: 100 },
      async visual => {
        await hideTitle(visual);
        await hideBackground(visual);
        await setTextboxParagraphs(visual, [
          {
            textRuns: [
              {
                value: "Adventure Works Geography Overview",
                textStyle: {
                  fontWeight: "bold",
                  fontSize: "24pt",
                  color: palette.text
                }
              }
            ]
          }
        ]);
      }
    );

    await createVisual(
      "textbox",
      { x: 28, y: 52, width: 460, height: 20, z: 100 },
      async visual => {
        await hideTitle(visual);
        await hideBackground(visual);
        await setTextboxParagraphs(visual, [
          {
            textRuns: [
              {
                value: "Executive dashboard for territory performance, category mix, and drill-in detail.",
                textStyle: {
                  fontSize: "10pt",
                  color: palette.subtext
                }
              }
            ]
          }
        ]);
      }
    );

    await createVisual(
      "textbox",
      { x: 846, y: 18, width: 170, height: 16, z: 1000 },
      async visual => {
        await hideTitle(visual);
        await hideBackground(visual);
        await setTextboxParagraphs(visual, [
          {
            textRuns: [
              {
                value: "Fiscal Year",
                textStyle: {
                  fontSize: "9pt",
                  color: palette.subtext
                }
              }
            ]
          }
        ]);
      }
    );

    await createVisual(
      "textbox",
      { x: 1030, y: 18, width: 222, height: 16, z: 1000 },
      async visual => {
        await hideTitle(visual);
        await hideBackground(visual);
        await setTextboxParagraphs(visual, [
          {
            textRuns: [
              {
                value: "Product Category",
                textStyle: {
                  fontSize: "9pt",
                  color: palette.subtext
                }
              }
            ]
          }
        ]);
      }
    );

    await createVisual(
      "slicer",
      { x: 846, y: 34, width: 170, height: 36, z: 1200 },
      async visual => {
        await helpers.addFirstMatchingRole(
          visual,
          ["Category", "Values", "Field"],
          helpers.column(dateTable, "Fiscal Year")
        );
      },
      styleDropdownSlicer
    );

    await createVisual(
      "slicer",
      { x: 1030, y: 34, width: 222, height: 36, z: 1200 },
      async visual => {
        await helpers.addFirstMatchingRole(
          visual,
          ["Category", "Values", "Field"],
          helpers.column(productTable, "Category")
        );
      },
      styleDropdownSlicer
    );

    await buildKpiStrip();

    await createVisual(
      "clusteredBarChart",
      { x: 28, y: 188, width: 390, height: 220, z: 400 },
      async visual => {
        await helpers.addFirstMatchingRole(
          visual,
          ["Category", "Axis", "SharedAxis"],
          helpers.column(territoryTable, "Region")
        );
        await helpers.addFirstMatchingRole(
          visual,
          ["Y", "Values", "Measure"],
          helpers.column(salesTable, "Sales Amount")
        );
        await setTitle(visual, "Revenue by Region");
      },
      styleTile
    );

    await createVisual(
      "lineChart",
      { x: 438, y: 188, width: 390, height: 220, z: 400 },
      async visual => {
        await helpers.addFirstMatchingRole(
          visual,
          ["Category", "Axis", "SharedAxis"],
          helpers.column(dateTable, "Month")
        );
        await helpers.addFirstMatchingRole(
          visual,
          ["Y", "Values", "Measure"],
          helpers.measure(salesTable, "Sales Amount by Due Date")
        );
        await setTitle(visual, "Due Date Revenue Trend");
      },
      styleTile
    );

    await createVisual(
      "donutChart",
      { x: 848, y: 188, width: 404, height: 220, z: 400 },
      async visual => {
        await helpers.addFirstMatchingRole(
          visual,
          ["Category", "Legend", "Details"],
          helpers.column(productTable, "Category")
        );
        await helpers.addFirstMatchingRole(
          visual,
          ["Y", "Values", "Measure"],
          helpers.column(salesTable, "Sales Amount")
        );
        await setTitle(visual, "Sales Mix by Category");
      },
      styleTile
    );

    await createVisual(
      "clusteredColumnChart",
      { x: 28, y: 430, width: 580, height: 238, z: 400 },
      async visual => {
        await helpers.addFirstMatchingRole(
          visual,
          ["Category", "Axis", "SharedAxis"],
          helpers.column(territoryTable, "Country")
        );
        await helpers.addFirstMatchingRole(
          visual,
          ["Series", "Legend"],
          helpers.column(productTable, "Category")
        );
        await helpers.addFirstMatchingRole(
          visual,
          ["Y", "Values", "Measure"],
          helpers.column(salesTable, "Sales Amount")
        );
        await setTitle(visual, "Country Revenue by Category");
      },
      styleTile
    );

    if (hasVisual("pivotTable")) {
      await createVisual(
        "pivotTable",
        { x: 628, y: 430, width: 624, height: 238, z: 400 },
        async visual => {
          const rowFields = [
            helpers.column(territoryTable, "Country"),
            helpers.column(territoryTable, "Region"),
            helpers.column(productTable, "Category")
          ];

          for (const field of rowFields) {
            await helpers.addFirstMatchingRole(visual, ["Rows", "Values", "Category"], field);
          }

          const valueFields = [
            helpers.column(salesTable, "Sales Amount"),
            helpers.column(salesTable, "Order Quantity")
          ];

          for (const field of valueFields) {
            await helpers.addFirstMatchingRole(visual, ["Values", "Rows"], field);
          }

          await setTitle(visual, "Geography Detail");
        },
        styleTile
      );
    } else {
      await createVisual(
        "tableEx",
        { x: 628, y: 430, width: 624, height: 238, z: 400 },
        async visual => {
          const fields = [
            helpers.column(territoryTable, "Country"),
            helpers.column(territoryTable, "Region"),
            helpers.column(productTable, "Category"),
            helpers.column(salesOrderTable, "Channel"),
            helpers.column(salesTable, "Sales Amount"),
            helpers.column(salesTable, "Order Quantity")
          ];

          for (const field of fields) {
            await helpers.addFirstMatchingRole(visual, ["Values", "Rows", "Category"], field);
          }

          await setTitle(visual, "Geography Detail");
        },
        styleTile
      );
    }

    await report.save();
  });
}
