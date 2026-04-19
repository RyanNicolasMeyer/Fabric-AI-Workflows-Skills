(function () {
  const MODE = document.body.dataset.mode || "view";
  const STATUS_LINE = document.getElementById("statusLine");
  const REPORT_NAME = document.getElementById("reportName");
  const CONTAINER = document.getElementById("reportContainer");

  function setStatus(message, level) {
    if (STATUS_LINE) {
      STATUS_LINE.textContent = message;
      STATUS_LINE.dataset.level = level || "info";
    }
    const tag = MODE === "edit" ? "[authoring]" : "[preview]";
    if (level === "error") {
      console.error(tag, message);
    } else {
      console.log(tag, message);
    }
  }

  function property(value) {
    return {
      schema: "http://powerbi.com/product/schema#property",
      value
    };
  }

  function measure(table, name) {
    return {
      $schema: "http://powerbi.com/product/schema#measure",
      table,
      measure: name
    };
  }

  function column(table, name) {
    return {
      $schema: "http://powerbi.com/product/schema#column",
      table,
      column: name
    };
  }

  async function getRoleNames(visual) {
    const capabilities = await visual.getCapabilities();
    const dataRoles = capabilities && Array.isArray(capabilities.dataRoles) ? capabilities.dataRoles : [];
    return dataRoles.map((role) => role.name);
  }

  async function addFirstMatchingRole(visual, candidates, target) {
    const roles = await getRoleNames(visual);
    const roleName = candidates.find((candidate) => roles.includes(candidate));
    if (!roleName) {
      throw new Error(
        "None of the requested roles were available. Wanted: " +
          candidates.join(", ") +
          ". Actual: " +
          roles.join(", ")
      );
    }

    await visual.addDataField(roleName, target);
    return roleName;
  }

  async function findPageByDisplayName(displayName) {
    const report = window.reportAuthoring && window.reportAuthoring.report
      ? window.reportAuthoring.report
      : window.reportPreview && window.reportPreview.report
        ? window.reportPreview.report
        : null;

    if (!report) {
      throw new Error("Embedded report is not available.");
    }

    const pages = await report.getPages();
    return pages.find((page) => page.displayName === displayName) || null;
  }

  async function clearPage(page) {
    const visuals = await page.getVisuals();
    for (const visual of visuals) {
      await page.deleteVisual(visual.name);
    }
  }

  async function showVisual(page, visual) {
    if (typeof page.setVisualDisplayState === "function") {
      try {
        await page.setVisualDisplayState(visual.name, 0);
      } catch (error) {
        console.warn("Unable to force visual display state.", error);
      }
    }
  }

  async function waitForReady(timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 30000);
    while (Date.now() < deadline) {
      const api = window.reportAuthoring;
      if (api && api.report && api.status && api.status.rendered) {
        return api;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Timed out waiting for the embedded report to render.");
  }

  async function bootstrap() {
    const config = window.REPORT_AUTHORING_SESSION;
    if (!config) {
      throw new Error("window.REPORT_AUTHORING_SESSION is missing.");
    }

    REPORT_NAME.textContent =
      MODE === "edit"
        ? config.reportName + " · edit mode"
        : config.reportName + " · view mode";

    const powerbiClient = window["powerbi-client"];
    if (!powerbiClient) {
      throw new Error("powerbi-client failed to load.");
    }

    const models = powerbiClient.models;
    const powerbi = new powerbiClient.service.Service(
      powerbiClient.factories.hpmFactory,
      powerbiClient.factories.wpmpFactory,
      powerbiClient.factories.routerFactory
    );

    const status = {
      mode: MODE,
      loaded: false,
      rendered: false,
      errors: [],
      lastSaveAt: null
    };

    const embedConfig = {
      type: "report",
      id: config.reportId,
      embedUrl: config.reportEmbedUrl,
      accessToken: config.accessToken,
      tokenType: models.TokenType[config.tokenType] || models.TokenType.Aad,
      permissions: MODE === "edit" ? models.Permissions.All : models.Permissions.Read,
      viewMode: MODE === "edit" ? models.ViewMode.Edit : models.ViewMode.View,
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true }
        }
      }
    };

    setStatus("Embedding report…");
    const report = powerbi.embed(CONTAINER, embedConfig);

    const api = {
      report,
      powerbi,
      models,
      config,
      status,
      errors: status.errors,
      lastSaveAt: null,
      helpers: {
        waitForReady,
        property,
        measure,
        column,
        getRoleNames,
        addFirstMatchingRole,
        findPageByDisplayName,
        clearPage,
        showVisual
      }
    };

    report.on("loaded", function () {
      status.loaded = true;
      setStatus("Report loaded.");
    });

    report.on("rendered", function () {
      status.rendered = true;
      setStatus("Report rendered and ready.");
    });

    report.on("saved", function () {
      status.lastSaveAt = new Date().toISOString();
      api.lastSaveAt = status.lastSaveAt;
      setStatus("Report saved.");
    });

    report.on("error", function (event) {
      const detail = event && event.detail ? event.detail : event;
      status.errors.push(detail);
      setStatus("Embed error: " + JSON.stringify(detail), "error");
    });

    window.reportAuthoring = MODE === "edit" ? api : undefined;
    window.reportPreview = MODE === "view" ? api : undefined;
  }

  bootstrap().catch(function (error) {
    setStatus(error && error.message ? error.message : String(error), "error");
    throw error;
  });
})();
