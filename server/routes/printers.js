const express = require("express");

const router = express.Router();
const { ensureAuthenticated, ensureAdministrator } = require("../config/auth");
const Logger = require("../handlers/logger.js");

const logger = new Logger("OctoFarm-API");

const { getPrinterManagerCache } = require("../cache/printer-manager.cache");

const { Script } = require("../services/server-scripts.service.js");

const _ = require("lodash");
const { getPrinterStoreCache } = require("../cache/printer-store.cache");
const { returnPrinterHealthChecks } = require("../store/printer-health-checks.store");
const { getPluginList, getPluginNoticesList } = require("../store/octoprint-plugin-list.store");
const { generatePrinterStatistics } = require("../services/printer-statistics.service");

router.post("/add", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  // Grab the API body
  const printers = req.body;
  // Send Dashboard to Runner..
  logger.info("Update printers request: ", printers);
  const p = await getPrinterManagerCache().addPrinter(printers);
  // Return printers added...
  res.send({ printersAdded: [p], status: 200 });
});

router.post("/update", ensureAuthenticated, ensureAdministrator, (req, res) => {
  // Grab the API body
  const printers = req.body;
  // Send Dashboard to Runner..
  logger.info("Update printers request: ", printers);
  const p = getPrinterManagerCache().bulkUpdateBasicPrinterInformation(printers);
  // Return printers added...
  res.send({ printersAdded: p, status: 200 });
});
router.post("/remove", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  // Grab the API body
  const printers = req.body;
  // Send Dashboard to Runner..
  logger.info("Delete printers request: ", printers);
  const p = await getPrinterManagerCache().bulkDeletePrinters(printers);
  // Return printers added...
  res.send({ printersRemoved: p, status: 200 });
});

// Register Handle for Saving printers
router.post("/removefile", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const file = req.body;
  logger.info("File deletion request: ", file.i);
  getPrinterStoreCache().deleteFile(file.i, file.fullPath);
  res.send("success");
});
router.post("/removefolder", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const folder = req.body;
  logger.info("Folder deletion request: ", folder.fullPath);
  getPrinterStoreCache().deleteFolder(folder.index, folder.fullPath);
  res.send(true);
});
router.post("/resyncFile", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const file = req.body;
  logger.info("File Re-sync request for: ", file);
  let ret = null;
  if (typeof file.fullPath !== "undefined") {
    ret = await getPrinterStoreCache().resyncFile(file.i, file.fullPath);
  } else {
    ret = await getPrinterStoreCache().resyncFilesList(file.i);
  }
  res.send(ret);
});
router.post("/stepChange", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const step = req.body;
  getPrinterStoreCache().updateStepRate(step.printer, step.newSteps);
  res.send("success");
});
router.post("/flowChange", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const step = req.body;
  getPrinterStoreCache().updateFlowRate(step.printer, step.newSteps);
  res.send("success");
});
router.post("/feedChange", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const step = req.body;
  getPrinterStoreCache().updateFeedRate(step.printer, step.newSteps);
  res.send("success");
});
router.post("/updateSettings", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  // Check required fields
  const settings = req.body;
  logger.info("Update printers request: ", settings);
  const updateSets = await getPrinterStoreCache().updatePrinterSettings(settings);
  res.send({});
});

router.get("/groups", ensureAuthenticated, async (req, res) => {
  const printers = getPrinterStoreCache().listPrintersInformation();
  const groups = [];
  for (let i = 0; i < printers.length; i++) {
    groups.push({
      _id: printers[i]._id,
      group: printers[i].group
    });
  }

  res.send(groups);
});

router.post("/printerInfo", ensureAuthenticated, async (req, res) => {
  const id = req.body.i;
  let returnedPrinterInformation;
  if (!id) {
    returnedPrinterInformation = getPrinterStoreCache().listPrintersInformation();
  } else {
    returnedPrinterInformation = getPrinterStoreCache().getPrinterInformation(id);
  }
  res.send(returnedPrinterInformation);
});

router.post(
  "/updatePrinterSettings",
  ensureAuthenticated,
  ensureAdministrator,
  async (req, res) => {
    const id = req.body.i;
    if (!id) {
      logger.error("Printer Settings: No ID key was provided");
      res.statusMessage = "No ID key was provided";
      res.sendStatus(400);
      return;
    }
    try {
      await getPrinterStoreCache().updateLatestOctoPrintSettings(id, true);
      logger.debug("Updating printer settings for: ", id);
      res.send(getPrinterStoreCache().getPrinterInformation(id));
    } catch (e) {
      logger.error(`The server couldn't update your printer settings! ${e}`);
      res.statusMessage = `The server couldn't update your printer settings! ${e}`;
      res.sendStatus(500);
    }
  }
);

router.post("/moveFile", ensureAuthenticated, async (req, res) => {
  const data = req.body;
  if (data.newPath === "/") {
    data.newPath = "local";
    data.newFullPath = data.newFullPath.replace("//", "");
  }
  logger.info("Move file request: ", data);
  getPrinterStoreCache().moveFile(data.index, data.newPath, data.newFullPath, data.fileName);
  res.send({ msg: "success" });
});
router.post("/moveFolder", ensureAuthenticated, async (req, res) => {
  const data = req.body;
  logger.info("Move folder request: ", data);
  getPrinterStoreCache().moveFolder(data.index, data.oldFolder, data.newFullPath, data.folderName);
  res.send({ msg: "success" });
});
router.post("/newFolder", ensureAuthenticated, async (req, res) => {
  const data = req.body;
  logger.info("New folder request: ", data);
  res.send({ msg: "success", files: getPrinterStoreCache().addNewFolder(data) });
});
router.post("/newFiles", ensureAuthenticated, async (req, res) => {
  const data = req.body;
  logger.info("Adding a new file to server: ", data);
  res.send({ msg: "success", files: getPrinterStoreCache().addNewFile(data) });
});
router.post("/reSyncAPI", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  const id = req.body.id;
  const force = req.body.force;
  logger.info(`Rescan ${id ? id : "All"} OctoPrint Requested. Forced: `, { force: force });
  await getPrinterManagerCache().reScanAPI(id, force);
  logger.info(`Rescan of ${id ? id : "All"} re-scan completed`);
  res.send({ msg: "Finished API Rescan..." });
});
router.post("/reSyncSockets", ensureAuthenticated, async (req, res) => {
  const id = req.body.id;
  logger.info("Rescan All OctoPrint Requests: ");
  try {
    await getPrinterManagerCache().reSyncWebsockets(id);
    logger.info("Full re-scan of OctoFarm completed");
    res.send({
      status: "success",
      msg: "Successfully Reconnected Socket! Please await reconnect."
    });
  } catch (e) {
    res.send({ status: "error", msg: `Couldn't Reconnect Socket! : ${e.message}` });
  }
});
router.post("/wakeHost", ensureAuthenticated, async (req, res) => {
  const data = req.body;
  logger.info("Action wake host: ", data);
  await Script.wol(data);
});
router.post("/updateSortIndex", ensureAuthenticated, ensureAdministrator, (req, res) => {
  const data = req.body;
  logger.info("Update printer sort indexes: ", data);
  res.send(getPrinterManagerCache().updatePrinterSortIndexes(data));
});
router.get("/connectionLogs/:id", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  let id = req.params.id;
  logger.info("Grabbing connection logs for: ", id);
  let connectionLogs = await getPrinterStoreCache().generatePrinterConnectionLogs(id);

  res.send(connectionLogs);
});
router.get("/pluginList", ensureAuthenticated, async (req, res) => {
  logger.info("Grabbing global plugin list");
  res.send(getPluginList());
});
router.get("/pluginNoticesList", ensureAuthenticated, async (req, res) => {
  logger.info("Grabbing global plugin notices list");
  res.send(getPluginNoticesList());
});
router.get("/disabledPluginList/:id", ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  logger.info("Grabbing disabled plugin list");
  res.send(getPrinterStoreCache().getDisabledPluginsList(id));
});
router.get("/enabledPluginList/:id", ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  logger.info("Grabbing enabled plugin list");
  res.send(getPrinterStoreCache().getEnabledPluginsList(id));
});
router.get("/allPluginsList/:id", ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  logger.info("Grabbing installed plugin list");
  res.send(getPrinterStoreCache().getAllPluginsList(id));
});

router.get("/scanNetwork", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  const { searchForDevicesOnNetwork } = require("../runners/autoDiscovery.js");

  let devices = await searchForDevicesOnNetwork();

  res.json(devices);
});

router.get("/listUniqueFolders", ensureAuthenticated, async (req, res) => {
  let uniqueFolderPaths = getPrinterStoreCache.listUniqueFolderPaths();
  res.json(uniqueFolderPaths);
});

router.get("/listUniqueFiles", ensureAuthenticated, async (req, res) => {
  let uniqueFolderPaths = getPrinterStoreCache().listUniqueFiles();
  res.json(uniqueFolderPaths);
});

router.get("/listUnifiedFiles/:ids", ensureAuthenticated, async (req, res) => {
  const idList = JSON.parse(req.params.ids);
  let uniqueFolderPaths = getPrinterStoreCache().listCommonFilesOnAllPrinters(idList);
  res.json(uniqueFolderPaths);
});

router.get("/healthChecks", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  res.send(returnPrinterHealthChecks(true));
});

router.get("/farmOverview", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  const returnArray = [];
  const printers = getPrinterStoreCache().listPrintersInformation();

  for (let i = 0; i < printers.length; i++) {
    let stats = getPrinterStoreCache().getPrinterStatistics(printers[i]._id);
    if (!stats) {
      stats = await generatePrinterStatistics(printers[i]._id);
      getPrinterStoreCache().updatePrinterStatistics(printers[i]._id, stats);
    }

    returnArray.push({
      octoPrintVersion: printers[i]?.octoPrintVersion,
      printerFirmware: printers[i]?.printerFirmware,
      statistics: stats
    });
  }

  res.send(returnArray);
});

router.patch("/disable/:id", ensureAuthenticated, ensureAdministrator, (req, res) => {
  const id = req.params.id;
  res.send(getPrinterStoreCache().disablePrinter(id));
});

router.patch("/enable/:id", ensureAuthenticated, ensureAdministrator, async (req, res) => {
  const id = req.params.id;
  res.send(await getPrinterStoreCache().enablePrinter(id));
});

module.exports = router;
