const express = require("express");

const router = express.Router();
const _ = require("lodash");
const History = require("../models/History.js");
const { ensureAuthenticated } = require("../config/auth");
const Printers = require("../models/Printer.js");
const Spools = require("../models/Filament.js");
const Profiles = require("../models/Profiles.js");
const ServerSettings = require("../models/ServerSettings.js");
const { getHistoryCache } = require("../cache/history.cache");
const { sortOptions } = require("../constants/history-sort.constants");
const { generatePrinterStatistics } = require("../services/printer-statistics.service");
const { getPrinterStoreCache } = require("../cache/printer-store.cache");

router.post("/update", ensureAuthenticated, async (req, res) => {
  // Check required fields
  const latest = req.body;
  const { note } = latest;
  const { filamentId } = latest;
  const history = await History.findOne({ _id: latest.id });
  if (history.printHistory.notes != note) {
    history.printHistory.notes = note;
  }
  for (let f = 0; f < filamentId.length; f++) {
    if (Array.isArray(history.printHistory.filamentSelection)) {
      if (
        typeof history.printHistory.filamentSelection[f] !== "undefined" &&
        history.printHistory.filamentSelection[f] !== null &&
        history.printHistory.filamentSelection[f]._id == filamentId
      ) {
        //Skip da save
      } else {
        if (filamentId[f] != 0) {
          const serverSettings = await ServerSettings.find({});
          const spool = await Spools.findById(filamentId[f]);

          if (serverSettings[0].filamentManager) {
            const profiles = await Profiles.find({});
            const profileIndex = _.findIndex(profiles, function (o) {
              return o.profile.index == spool.spools.profile;
            });
            spool.spools.profile = profiles[profileIndex].profile;
            history.printHistory.filamentSelection[f] = spool;
          } else {
            const profile = await Profiles.findById(spool.spools.profile);
            spool.spools.profile = profile.profile;
            history.printHistory.filamentSelection[f] = spool;
          }
        } else {
          filamentId.forEach((id, index) => {
            history.printHistory.filamentSelection[index] = null;
          });
        }
      }
    } else {
      if (
        history.printHistory.filamentSelection !== null &&
        history.printHistory.filamentSelection._id == filamentId
      ) {
        //Skip da save
      } else {
        history.printHistory.filamentSelection = [];
        if (filamentId[f] != 0) {
          const serverSettings = await ServerSettings.find({});
          const spool = await Spools.findById(filamentId[f]);

          if (serverSettings[0].filamentManager) {
            const profiles = await Profiles.find({});
            const profileIndex = _.findIndex(profiles, function (o) {
              return o.profile.index == spool.spools.profile;
            });
            spool.spools.profile = profiles[profileIndex].profile;
            history.printHistory.filamentSelection[f] = spool;
          } else {
            const profile = await Profiles.findById(spool.spools.profile);
            spool.spools.profile = profile.profile;
            history.printHistory.filamentSelection[f] = spool;
          }
        } else {
          filamentId.forEach((id, index) => {
            history.printHistory.filamentSelection[index] = null;
          });
        }
      }
    }
  }
  history.markModified("printHistory");
  history.save().then(() => {
    getHistoryCache().initCache();
  });
  res.send("success");
});
//Register Handle for Saving printers
router.post("/delete", ensureAuthenticated, async (req, res) => {
  //Check required fields
  const deleteHistory = req.body;
  await History.findOneAndDelete({ _id: deleteHistory.id }).then(() => {
    getHistoryCache().initCache();
  });
  res.send("success");
});

router.get("/get", ensureAuthenticated, async (req, res) => {
  const { page, limit, sort } = req.query;
  let paginationOptions = {};

  paginationOptions.page = page;

  paginationOptions.limit = limit;

  paginationOptions.sort = sortOptions[sort];

  const {
    firstDate,
    lastDate,
    fileFilter,
    pathFilter,
    spoolManuFilter,
    spoolMatFilter,
    fileSearch,
    spoolSearch,
    printerNameFilter,
    printerGroupFilter,
    printerSearch
  } = req.query;

  const findOptions = {
    "printHistory.endDate": { $gte: new Date(lastDate), $lte: new Date(firstDate) }
  };
  if (fileFilter) {
    findOptions["printHistory.fileName"] = fileFilter;
  }

  if (printerNameFilter) {
    findOptions["printHistory.printerName"] = printerNameFilter;
  }

  if (printerGroupFilter) {
    findOptions["printHistory.printerGroup"] = printerGroupFilter;
  }

  if (pathFilter) {
    findOptions["printHistory.job.file.path"] = new RegExp(pathFilter, "g");
  }
  if (spoolManuFilter) {
    findOptions["printHistory.filamentSelection.spools.profile.manufacturer"] = new RegExp(
      spoolManuFilter.replace(/_/g, " "),
      "g"
    );
  }
  if (spoolMatFilter) {
    findOptions["printHistory.filamentSelection.spools.profile.material"] = new RegExp(
      spoolMatFilter.replace(/_/g, " "),
      "g"
    );
  }

  if (fileSearch) {
    findOptions["printHistory.fileName"] = new RegExp(fileSearch.replace(/_/g, " "), "g");
  }

  if (printerSearch) {
    findOptions["printHistory.printerName"] = new RegExp(printerSearch.replace(/_/g, " "), "g");
  }

  if (spoolSearch) {
    findOptions["printHistory.filamentSelection.spools.name"] = new RegExp(
      spoolSearch.replace(/_/g, " "),
      "g"
    );
  }

  const historyCache = getHistoryCache();

  const { historyClean, statisticsClean, pagination } = await historyCache.initCache(
    findOptions,
    paginationOptions
  );

  const historyFilterData = historyCache.generateHistoryFilterData(historyClean);

  res.send({
    history: historyClean,
    statisticsClean,
    pagination,
    monthlyStatistics: historyCache.monthlyStatistics,
    historyFilterData
  });
});

router.get("/statisticsData", ensureAuthenticated, async (req, res) => {
  const historyCache = getHistoryCache();
  const stats = historyCache.generateStatistics();

  res.send({ history: stats });
});
router.post("/updateCostMatch", ensureAuthenticated, async (req, res) => {
  const latest = req.body;

  // Find history and matching printer ID
  const historyEntity = await History.findOne({ _id: latest.id });
  const printers = await Printers.find({});
  const printer = _.findIndex(printers, function (o) {
    return o.settingsAppearance.name == historyEntity.printHistory.printerName;
  });
  if (printer > -1) {
    historyEntity.printHistory.costSettings = printers[printer].costSettings;
    historyEntity.markModified("printHistory");
    historyEntity.save();
    const send = {
      status: 200,
      printTime: historyEntity.printHistory.printTime,
      costSettings: printers[printer].costSettings
    };
    res.send(send);
  } else {
    historyEntity.printHistory.costSettings = {
      powerConsumption: 0.5,
      electricityCosts: 0.15,
      purchasePrice: 500,
      estimateLifespan: 43800,
      maintenanceCosts: 0.25
    };
    const send = {
      status: 400,
      printTime: historyEntity.printHistory.printTime,
      costSettings: historyEntity.printHistory.costSettings
    };
    historyEntity.markModified("printHistory");
    historyEntity.save().then(() => {
      getHistoryCache().initCache();
    });

    res.send(send);
  }
});
router.get("/statistics/:id", ensureAuthenticated, async function (req, res) {
  const printerID = req.params.id;
  let stats = getPrinterStoreCache().getPrinterStatistics(printerID);
  if (!stats) {
    stats = await generatePrinterStatistics(printerID);
    getPrinterStoreCache().updatePrinterStatistics(printerID, stats);
  }
  res.send(stats);
});

module.exports = router;
