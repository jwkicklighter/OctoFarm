import OctoPrintClient from "../octoprint-client.service";
import OctoFarmClient from "../octofarm-client.service";

async function setupOctoPrintForTimelapses(printers) {
  let successfulPrinters = "";
  let failedPrinters = "";

  let webCamSettings = {
    webcam: {
      ffmpegVideoCodec: "libx264",
      webcamEnabled: true
    }
  };
  let timeLapseSettings = {
    type: "zchange"
  };
  for (let i = 0; i < printers.length; i++) {
    if (printers[i].printerState.colour.category !== "Offline") {
      await OctoPrintClient.post(printers[i], "settings", webCamSettings);
      await OctoPrintClient.post(printers[i], "timelapse", timeLapseSettings);
      await OctoFarmClient.refreshPrinterSettings(printers[i]._id);
      successfulPrinters += `<i class="fas fa-check-circle text-success"></i> ${printers[i].printerName}: Settings Updated! <br>`;
    } else {
      failedPrinters += `<i class="fas fa-check-circle text-danger"></i> ${printers[i].printerName}: Offline! <br>`;
    }
  }
  return {
    successfulPrinters,
    failedPrinters
  };
}

async function setupOctoPrintForFilamentManager(printers, settings) {
  let successfulPrinters = "";
  let failedPrinters = "";

  const { uri, name, user, password } = settings;

  const filamentManagerSettings = {
    plugins: {
      filamentmanager: {
        database: {
          uri: uri,
          name: name,
          user: user,
          password: password,
          useExternal: true
        }
      }
    }
  };
  for (let i = 0; i < printers.length; i++) {
    if (printers[i].printerState.colour.category !== "Offline") {
      await OctoPrintClient.post(printers[i], "settings", filamentManagerSettings);
      await OctoFarmClient.refreshPrinterSettings(printers[i]._id);
      successfulPrinters += `<i class="fas fa-check-circle text-success"></i> ${printers[i].printerName}: Settings Updated! <br>`;
    } else {
      failedPrinters += `<i class="fas fa-check-circle text-danger"></i> ${printers[i].printerName}: Offline! <br>`;
    }
  }
  return {
    successfulPrinters,
    failedPrinters
  };
}

async function setupOctoPrintForVirtualPrinter(printers) {
  let successfulPrinters = "";
  let failedPrinters = "";

  let virtualPrinterSettings = {
    plugins: {
      virtual_printer: {
        enabled: true
      }
    }
  };
  for (let i = 0; i < printers.length; i++) {
    if (printers[i].printerState.colour.category !== "Offline") {
      await OctoPrintClient.post(printers[i], "settings", virtualPrinterSettings);
      await OctoFarmClient.refreshPrinterSettings(printers[i]._id);
      successfulPrinters += `<i class="fas fa-check-circle text-success"></i> ${printers[i].printerName}: Settings Updated! <br>`;
    } else {
      failedPrinters += `<i class="fas fa-check-circle text-danger"></i> ${printers[i].printerName}: Offline! <br>`;
    }
  }
  return {
    successfulPrinters,
    failedPrinters
  };
}

export {
  setupOctoPrintForTimelapses,
  setupOctoPrintForFilamentManager,
  setupOctoPrintForVirtualPrinter
};
