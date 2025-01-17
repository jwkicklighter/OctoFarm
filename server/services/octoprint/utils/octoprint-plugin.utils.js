const { getPrinterStoreCache } = require("../../../cache/printer-store.cache");
const { PrinterTicker } = require("../../../runners/printerTicker");

const addOctoPrintLogWrapper = (id, message, state) => {
  PrinterTicker.addOctoPrintLog(
    getPrinterStoreCache().getPrinter(id),
    message,
    state,
    "pluginmanager"
  );
};

const addOctoPrintIssueWrapper = (id, message, state) => {
  PrinterTicker.addIssue(new Date(), getPrinterStoreCache().getPrinterURL(id), message, state, id);
};

/**
 * One time function run on first scan to get plugin data.
 * @params currentSettings
 * @params plugins
 * @returns {string}
 */
const testAndCollectCostPlugin = (currentSettings, plugins) => {
  if (currentSettings === null) {
    if (plugins["costestimation"]) {
      return {
        powerConsumption: plugins["costestimation"].powerConsumption,
        electricityCosts: plugins["costestimation"].costOfElectricity,
        purchasePrice: plugins["costestimation"].priceOfPrinter,
        estimateLifespan: plugins["costestimation"].lifespanOfPrinter,
        maintenanceCosts: plugins["costestimation"].maintenanceCosts
      };
    } else {
      return {
        powerConsumption: 0.5,
        electricityCosts: 0.15,
        purchasePrice: 500,
        estimateLifespan: 43800,
        maintenanceCosts: 0.25
      };
    }
  } else {
    return currentSettings;
  }
};
/**
 * One time function run on first scan to get plugin data.
 * @params currentSettings
 * @params plugins
 * @returns {string}
 */
const testAndCollectPSUControlPlugin = (currentSettings, plugins) => {
  if (currentSettings === null) {
    if (plugins["psucontrol"]) {
      return {
        powerOnCommand: '{"command":"turnPSUOn"}',
        powerOnURL: "[PrinterURL]/api/plugin/psucontrol",
        powerOffCommand: '{"command":"turnPSUOff"}',
        powerOffURL: "[PrinterURL]/api/plugin/psucontrol",
        powerToggleCommand: '{"command":"togglePSU"}',
        powerToggleURL: "[PrinterURL]/api/plugin/psucontrol",
        powerStatusCommand: '{"command":"getPSUState"}',
        powerStatusURL: "[PrinterURL]/api/plugin/psucontrol",
        wol: {
          enabled: false,
          ip: "255.255.255.0",
          packets: "3",
          port: "9",
          interval: "100",
          MAC: ""
        }
      };
    } else {
      return {
        powerOnCommand: "",
        powerOnURL: "",
        powerOffCommand: "",
        powerOffURL: "",
        powerToggleCommand: "",
        powerToggleURL: "",
        powerStatusCommand: "",
        powerStatusURL: "",
        wol: {
          enabled: false,
          ip: "255.255.255.0",
          packets: "3",
          port: "9",
          interval: "100",
          MAC: ""
        }
      };
    }
  } else {
    return currentSettings;
  }
};

//TODO check this actually works...
const captureKlipperPluginData = (id, data) => {
  const { payload } = data;
  if (payload.includes("Firmware version:")) {
    getPrinterStoreCache().updatePrinterLiveValue(id, {
      klipperFirmwareVersion: payload.replace("Firmware version: ", "")
    });
  }
};

const capturePluginManagerData = (id, type, data) => {
  switch (type) {
    case "loglines":
      const { loglines } = data;
      captureLogLines(id, loglines);
      break;
    case "result":
      captureResultsData(id, data);
      break;
  }
};

const captureResultsData = (id, data) => {
  const { action, result, needs_restart } = data;
  if (needs_restart) {
    getPrinterStoreCache().updatePrinterLiveValue(id, {
      restartRequired: true
    });
  }
  const message = `Action: ${action} has ${
    result ? "successfully completed" : "failed to complete"
  } | Restart Required: ${needs_restart}`;
  const state = result ? "Complete" : "Offline";
  addOctoPrintLogWrapper(id, message, state);
  addOctoPrintIssueWrapper(id, message, state);
};

const captureLogLines = (id, data) => {
  if (!!data && data.length > 0) {
    data.forEach((line) => {
      if (line.stream === "call" || line.stream === "message") {
        addOctoPrintLogWrapper(id, line.line, "Active");
      }
      if (line.stream === "stdout") {
        addOctoPrintLogWrapper(id, line.line, "Complete");
      }
      if (line.stream === "stderr") {
        addOctoPrintLogWrapper(id, line.line, "Offline");
        addOctoPrintIssueWrapper(id, line.line, "Offline");
      }
      if (line.line.includes("Successfully installed")) {
        addOctoPrintIssueWrapper(id, line.line, "Complete");
      }
      if (line.line.includes("Successfully built")) {
        addOctoPrintIssueWrapper(id, line.line, "Active");
      }
      if (line.line.includes("Uninstalling")) {
        addOctoPrintIssueWrapper(id, line.line, "Offline");
      }
      if (line.line.includes("Processing")) {
        addOctoPrintIssueWrapper(id, line.line, "Active");
      }
    });
  }
};

module.exports = {
  testAndCollectPSUControlPlugin,
  testAndCollectCostPlugin,
  captureKlipperPluginData,
  capturePluginManagerData
};
