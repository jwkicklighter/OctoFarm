import OctoFarmClient from "../../services/octofarm-client.service";
import UI from "../../utils/ui";
import Calc from "../../utils/calc";
import FileOperations from "../../utils/file";
import {
  setupOctoPrintForFilamentManager,
  setupOctoPrintForTimelapses
} from "../../services/octoprint/octoprint-settings.actions";
import {
  isFilamentManagerPluginSyncEnabled,
  setupFilamentManagerDisableBtn,
  setupFilamentManagerReSyncBtn,
  setupFilamentManagerSyncBtn
} from "../../services/filament-manager-plugin.service";
import {
  filamentManagerPluginActionElements,
  returnSaveBtn,
  settingsElements,
  userActionElements
} from "./server.options";
import {serverBootBoxOptions} from "./utils/bootbox.options";
import ApexCharts from "apexcharts";

let historicUsageGraph;
let cpuUsageDonut;
let memoryUsageDonut;

const options = {
  series: [],
  chart: {
    id: "realtime",
    height: 300,
    type: "line",
    background: "#303030",
    animations: {
      enabled: true,
      easing: "linear",
      dynamicAnimation: {
        speed: 1000
      }
    },
    toolbar: {
      show: false
    },
    zoom: {
      enabled: false
    }
  },
  dataLabels: {
    enabled: false
  },
  theme: {
    mode: "dark"
  },
  noData: {
    text: "Loading Data..."
  },
  stroke: {
    curve: "smooth"
  },
  title: {
    text: "CPU and Memory Usage History",
    align: "left"
  },
  markers: {
    size: 0
  },
  xaxis: {
    type: "datetime"
  },
  yaxis: {
    max: 100
  },
  legend: {
    show: true,
    showForSingleSeries: false,
    showForNullSeries: true,
    showForZeroSeries: true,
    position: "bottom",
    horizontalAlign: "center",
    floating: false,
    fontSize: "14px",
    fontFamily: "Helvetica, Arial",
    fontWeight: 400,
    formatter: undefined,
    inverseOrder: false,
    width: undefined,
    height: undefined,
    tooltipHoverFormatter: undefined,
    customLegendItems: [],
    offsetX: 0,
    offsetY: 0,
    labels: {
      colors: undefined,
      useSeriesColors: false
    },
    markers: {
      width: 12,
      height: 12,
      strokeWidth: 0,
      strokeColor: "#fff",
      fillColors: undefined,
      radius: 12,
      customHTML: undefined,
      onClick: undefined,
      offsetX: 0,
      offsetY: 0
    },
    itemMargin: {
      horizontal: 5,
      vertical: 0
    },
    onItemClick: {
      toggleDataSeries: true
    },
    onItemHover: {
      highlightDataSeries: true
    }
  }
};
const cpuOptions = {
  chart: {
    height: 350,
    type: "radialBar",
    background: "#303030",
    animations: {
      enabled: true,
      easing: "linear",
      dynamicAnimation: {
        speed: 1000
      }
    }
  },
  theme: {
    mode: "dark"
  },
  noData: {
    text: "Loading Data..."
  },
  series: [],
  labels: ["CPU Usage"]
};
const memoryOptions = {
  chart: {
    height: 350,
    type: "radialBar",
    background: "#303030",
    animations: {
      enabled: true,
      easing: "linear",
      dynamicAnimation: {
        speed: 1000
      }
    }
  },
  theme: {
    mode: "dark"
  },
  noData: {
    text: "Loading Data..."
  },
  series: [],
  labels: ["Memory Usage"]
};

async function setupOPTimelapseSettings() {
  const printers = await OctoFarmClient.listPrinters();
  const alert = UI.createAlert(
    "warning",
    `${UI.returnSpinnerTemplate()} Setting up your OctoPrint settings, please wait...`
  );
  const { successfulPrinters, failedPrinters } = await setupOctoPrintForTimelapses(printers);
  alert.close();
  bootbox.alert(successfulPrinters + failedPrinters);
}

async function setupOPFilamentManagerPluginSettings() {
  const printers = await OctoFarmClient.listPrinters();
  const alert = UI.createAlert(
    "warning",
    `${UI.returnSpinnerTemplate()} Setting up your OctoPrint settings, please wait...`
  );

  const settings = {
    uri: filamentManagerPluginActionElements.postgresURI.value,
    name: filamentManagerPluginActionElements.databaseName.value,
    user: filamentManagerPluginActionElements.username.value,
    password: filamentManagerPluginActionElements.password.value
  };

  if (!settings.uri.includes("postgresql://")) {
    UI.createAlert("warning", "Your postgres URI isn't configured correctly!", 3000, "clicked");
    alert.close();
    return;
  }
  if (!settings.uri || !settings.name || !settings.user || !settings.password) {
    UI.createAlert("warning", "You are missing some required fields!", 3000, "clicked");
    alert.close();
    return;
  }

  const { successfulPrinters, failedPrinters } = await setupOctoPrintForFilamentManager(
    printers,
    settings
  );

  filamentManagerPluginActionElements.postgresURI.value = "";
  filamentManagerPluginActionElements.databaseName.value = "";
  filamentManagerPluginActionElements.username.value = "";
  filamentManagerPluginActionElements.password.value = "";

  alert.close();
  bootbox.alert(successfulPrinters + failedPrinters);
}

async function generateLogDumpFile() {
  let logDumpResponse = await OctoFarmClient.generateLogDump();

  if (!logDumpResponse?.status || !logDumpResponse?.msg || !logDumpResponse?.zipDumpPath) {
    UI.createAlert(
      "error",
      "There was an issue with the servers response, please check your logs",
      0,
      "clicked"
    );
    return;
  }

  UI.createAlert(logDumpResponse.status, logDumpResponse.msg, 5000, "clicked");

  // Error detected so no need to create button.
  if (logDumpResponse.status === "error") {
    return;
  }

  const logDumpDownloadBtn = document.getElementById("logDumpDownloadBtn");

  if (logDumpDownloadBtn) {
    logDumpDownloadBtn.classList.remove("d-none");
    logDumpDownloadBtn.addEventListener("click", (e) => {
      setTimeout(() => {
        logDumpDownloadBtn.classList.add("d-none");
      }, 5000);
      window.open(
        `${OctoFarmClient.logsRoute.replace("/logs", "")}/${logDumpResponse.zipDumpPath}`
      );
    });
  }
}

async function nukeDatabases(database) {
  let databaseNuke;
  if (!database) {
    databaseNuke = await OctoFarmClient.get("settings/server/delete/database");
  } else {
    databaseNuke = await OctoFarmClient.get("settings/server/delete/database/" + database);
  }
  UI.createAlert("success", databaseNuke.message, 3000);
}

async function exportDatabases(database) {
  const databaseExport = await OctoFarmClient.get("settings/server/get/database/" + database);

  if (databaseExport?.databases[0].length !== 0) {
    FileOperations.download(database + ".json", JSON.stringify(databaseExport.databases));
  } else {
    UI.createAlert("warning", "Database is empty, will not export...", 3000, "clicked");
  }
}

async function restartOctoFarmServer() {
  let systemRestartBtn = document.getElementById("restartOctoFarmBtn");
  // Make sure the system button is disabled whilst the restart is happening.
  if (systemRestartBtn) {
    systemRestartBtn.disabled = true;
  }
  let restart = await OctoFarmClient.restartServer();
  if (restart) {
    UI.createAlert(
      "success",
      "System restart command was successful, the server will restart in 5 seconds...",
      5000,
      "clicked"
    );
  } else {
    UI.createAlert(
      "error",
      "Service restart failed... Please check: <a href='https://docs.octofarm.net/installation/setup-service.html'> OctoFarm Service Setup </a> for more information ",
      5000,
      "clicked"
    );
  }

  setTimeout(() => {
    if (systemRestartBtn) {
      systemRestartBtn.disabled = false;
    }
  }, 5000);
}

async function checkFilamentManagerPluginState() {
  if (await isFilamentManagerPluginSyncEnabled()) {
    setupFilamentManagerReSyncBtn();
    setupFilamentManagerDisableBtn();
  } else {
    setupFilamentManagerSyncBtn();
  }
}

async function updateServerSettings() {
  const opts = {
    onlinePolling: {
      seconds: settingsElements.onlinePolling.seconds.value
    },
    server: {
      // Deprecated Port
      port: settingsElements.server.port.value,
      loginRequired: settingsElements.server.loginRequired.checked,
      registration: settingsElements.server.registration.checked
    },
    timeout: {
      webSocketRetry: settingsElements.timeout.webSocketRetry.value * 1000,
      apiTimeout: settingsElements.timeout.apiTimeout.value * 1000,
      apiRetryCutoff: settingsElements.timeout.apiRetryCutoff.value * 1000,
      apiRetry: settingsElements.timeout.apiRetry.value * 1000
    },
    filament: {
      filamentCheck: settingsElements.filament.filamentCheck.checked,
      hideEmpty: settingsElements.filament.hideEmpty.checked,
      downDateFailed: settingsElements.filament.downDateFailed.checked,
      downDateSuccess: settingsElements.filament.downDateSuccess.checked
    },
    history: {
      snapshot: {
        onComplete: settingsElements.history.snapshot.onComplete.checked,
        onFailure: settingsElements.history.snapshot.onComplete.checked
      },
      thumbnails: {
        onComplete: settingsElements.history.thumbnails.onComplete.checked,
        onFailure: settingsElements.history.thumbnails.onComplete.checked
      },
      timelapse: {
        onComplete: settingsElements.history.timelapse.onComplete.checked,
        onFailure: settingsElements.history.timelapse.onComplete.checked,
        deleteAfter: settingsElements.history.timelapse.onComplete.checked
      }
    },
    influxExport: {
      active: settingsElements.influxExport.active.checked,
      host: settingsElements.influxExport.host.value,
      port: settingsElements.influxExport.port.value,
      database: settingsElements.influxExport.database.value,
      username: settingsElements.influxExport.username.value,
      password: settingsElements.influxExport.password.value,
      retentionPolicy: {
        duration: settingsElements.influxExport.retentionPolicy.duration.value,
        replication: settingsElements.influxExport.retentionPolicy.replication.value,
        defaultRet: settingsElements.influxExport.retentionPolicy.defaultRet.checked
      }
    },
    monitoringViews: {
      panel: settingsElements.monitoringViews.panel.checked,
      list: settingsElements.monitoringViews.list.checked,
      camera: settingsElements.monitoringViews.camera.checked,
      group: settingsElements.monitoringViews.group.checked,
      currentOperations: settingsElements.monitoringViews.currentOperations.checked,
      combined: settingsElements.monitoringViews.combined.checked
    }
  };

  OctoFarmClient.post("settings/server/update", opts).then((res) => {
    UI.createAlert(`${res.status}`, `${res.msg}`, 3000, "Clicked");
    if (res.restartRequired) {
      bootbox.confirm(serverBootBoxOptions.OF_SERVER_RESTART_REQUIRED);
    }
  });
}

async function updateOctoFarmCommand(doWeForcePull, doWeInstallPackages) {
  let updateOctoFarmBtn = document.getElementById("updateOctoFarmBtn");
  // Make sure the update OctoFarm button is disabled after keypress
  if (updateOctoFarmBtn) {
    updateOctoFarmBtn.disabled = true;
    UI.addLoaderToElementsInnerHTML(updateOctoFarmBtn);
  }
  let updateData = {
    forcePull: false,
    doWeInstallPackages: false
  };
  if (doWeForcePull) {
    updateData.forcePull = true;
  }
  if (doWeInstallPackages) {
    updateData.doWeInstallPackages = true;
  }

  let updateOctoFarm = await OctoFarmClient.post("settings/server/update/octofarm", updateData);

  // Local changes are detected, question whether we overwrite or cancel..
  if (
    updateOctoFarm.message.includes("The update is failing due to local changes been detected.")
  ) {
    bootbox.confirm(
      serverBootBoxOptions.OF_UPDATE_LOCAL_CHANGES(updateOctoFarmBtn, updateOctoFarm.message)
    );
    return;
  }
  // Local changes are detected, question whether we overwrite or cancel..
  if (
    updateOctoFarm.message.includes(
      "You have missing dependencies that are required, Do you want to update these?"
    )
  ) {
    bootbox.confirm();
    return;
  }

  UI.createAlert(
    `${updateOctoFarm?.statusTypeForUser}`,
    `${updateOctoFarm?.message}`,
    0,
    "clicked"
  );
  UI.removeLoaderFromElementInnerHTML(updateOctoFarmBtn);

  if (updateOctoFarm?.haveWeSuccessfullyUpdatedOctoFarm) {
    UI.createAlert(
      "success",
      "We have successfully updated... OctoFarm will restart now.",
      0,
      "Clicked"
    );
    await restartOctoFarmServer();
  }
}

async function checkForOctoFarmUpdates() {
  let forceCheckForUpdatesBtn = document.getElementById("checkUpdatesForOctoFarmBtn");
  // Make sure check button is disbaled after key press
  if (forceCheckForUpdatesBtn) {
    forceCheckForUpdatesBtn.disabled = true;
  }

  let updateCheck = await OctoFarmClient.get("settings/server/update/octofarm");

  if (updateCheck?.air_gapped) {
    UI.createAlert(
      "error",
      "Your farm has no internet connection, this function requires an active connection to check for releases...",
      5000,
      "Clicked"
    );
    return;
  }
  if (updateCheck?.update_available) {
    UI.createAlert(
      "success",
      "We found a new update, please use the update button to action!",
      5000,
      "Clicked"
    );
  } else {
    UI.createAlert("warning", "Sorry there are no new updates available!", 5000, "Clicked");
  }

  setTimeout(() => {
    if (forceCheckForUpdatesBtn) {
      forceCheckForUpdatesBtn.disabled = false;
    }
  }, 5000);
}

async function grabOctoFarmLogList() {
  let logList = await OctoFarmClient.get(OctoFarmClient.logsRoute);
  const logTable = document.getElementById("serverLogs");
  logList.forEach((logs) => {
    logTable.insertAdjacentHTML(
      "beforeend",
      `
            <tr>
                <td>${logs.name}</td>
                <td>${new Date(logs.modified).toString().substring(0, 21)}</td>
                <td>${Calc.bytes(logs.size)}</td>
                <td><button id="${
                  logs.name
                }" type="button" class="btn btn-sm btn-primary"><i class="fas fa-download"></i></button></td>
            </tr>
        `
    );
    document.getElementById(logs.name).addEventListener("click", async (event) => {
      window.open(`${OctoFarmClient.logsRoute}/${logs.name}`);
    });
  });
}

async function renderSystemCharts() {
  historicUsageGraph = new ApexCharts(document.querySelector("#historicUsageGraph"), options);
  await historicUsageGraph.render();
  cpuUsageDonut = new ApexCharts(document.querySelector("#cpuUsageDonut"), cpuOptions);
  await cpuUsageDonut.render();
  memoryUsageDonut = new ApexCharts(document.querySelector("#memoryUsageDonut"), memoryOptions);
  await memoryUsageDonut.render();
}

async function updateLiveSystemInformation() {
  const options = {
    noData: {
      text: "No data to display yet!"
    }
  };
  const systemInformation = await OctoFarmClient.get("system/info");
  const sysUptimeElem = document.getElementById("systemUptime");
  const procUptimeElem = document.getElementById("processUpdate");

  if(!systemInformation) return;

  if (systemInformation?.uptime && !!procUptimeElem) {
    procUptimeElem.innerHTML = Calc.generateTime(systemInformation.uptime);
  }

  if (systemInformation?.osUptime && !!sysUptimeElem) {
    sysUptimeElem.innerHTML = Calc.generateTime(systemInformation.osUptime);
  }

  if (systemInformation.memoryLoadHistory.length > 0) {
    await memoryUsageDonut.updateSeries([
      systemInformation.memoryLoadHistory[systemInformation.memoryLoadHistory.length - 1].y
    ]);
  } else {
    await historicUsageGraph.updateOptions(options);
  }

  if (systemInformation.cpuLoadHistory.length > 0) {
    await cpuUsageDonut.updateSeries([
      systemInformation.cpuLoadHistory[systemInformation.cpuLoadHistory.length - 1].y
    ]);
  } else {
    await historicUsageGraph.updateOptions(options);
  }

  if (systemInformation.memoryLoadHistory.length > 5) {
    const dataSeriesForCharts = [
      {
        name: "Memory",
        data: systemInformation.memoryLoadHistory
      },
      {
        name: "CPU",
        data: systemInformation.cpuLoadHistory
      }
    ];
    await historicUsageGraph.updateSeries(dataSeriesForCharts);
  } else {
    await historicUsageGraph.updateOptions(options);
  }
}

async function startUpdateInfoRunner() {
  await updateLiveSystemInformation();
  setInterval(await updateLiveSystemInformation, 5000);
}

function startUpdateTasksRunner() {
  setInterval(async function updateStatus() {
    const taskManagerState = await OctoFarmClient.get("system/tasks");

    for (let task in taskManagerState) {
      const theTask = taskManagerState[task];

      UI.doesElementNeedUpdating(
        theTask.firstCompletion
          ? new Date(theTask.firstCompletion).toLocaleString().replace(",", ": ")
          : "Not Finished",
        document.getElementById("firstExecution-" + task),
        "innerHTML"
      );

      UI.doesElementNeedUpdating(
        theTask.lastExecuted
          ? new Date(theTask.lastExecuted).toLocaleString().replace(",", ": ")
          : "Not Finished",
        document.getElementById("lastExecution-" + task),
        "innerHTML"
      );

      UI.doesElementNeedUpdating(
        theTask.duration
          ? UI.generateMilisecondsTime(theTask.duration)
          : "<i class=\"fas fa-sync fa-spin\"></i>",
        document.getElementById("duration-" + task),
        "innerHTML"
      );

      UI.doesElementNeedUpdating(
        theTask.nextRun
          ? new Date(theTask.nextRun).toLocaleString().replace(",", ": ")
          : "Not Planned",
        document.getElementById("next-" + task),
        "innerHTML"
      );
    }
  }, 1500);
}

async function createNewUser() {
  userActionElements.userCreateMessage.innerHTML = "";
  const newUser = {
    name: userActionElements.createName.value,
    username: userActionElements.createUserName.value,
    group: userActionElements.createGroup.value,
    password: userActionElements.createPassword.value,
    password2: userActionElements.createPassword2.value
  };
  const createNewUser = await OctoFarmClient.createNewUser(newUser);

  if (createNewUser.errors.length > 0) {
    createNewUser.errors.forEach((error) => {
      userActionElements.userCreateMessage.insertAdjacentHTML(
        "beforeend",
        `
        <div class="alert alert-warning text-dark" role="alert">
          <i class="fas fa-exclamation-triangle"></i> ${error.msg}
        </div>
        `
      );
    });
  } else {
    const createdUser = createNewUser.createdNewUser;
    userActionElements.userTableContent.insertAdjacentHTML(
      "beforeend",
      ` 
                <tr id="userRow-${createdUser._id}">
                        <th scope="row">${createdUser.name}</th>
                        <td>${createdUser.username}</td>
                        <td>${createdUser.group}</td>
                        <td>${new Date(createdUser.date).toLocaleDateString()}</td>
                        <td>
                            <button id="resetPasswordBtn-${
                              createdUser._id
                            }" type="button" class="btn btn-warning text-dark btn-sm" data-toggle="modal" data-target="#usersResetPasswordModal"><i class="fas fa-user-shield"></i> Reset Password</button>
                            <button id="editUserBtn-${
                              createdUser._id
                            }" type="button" class="btn btn-info btn-sm" data-toggle="modal" data-target="#userEditModal"><i class="fas fa-user-edit"></i> Edit</button>
                            <button id="deleteUserBtn-${
                              createdUser._id
                            }" type="button" class="btn btn-danger btn-sm"><i class="fas fa-user-minus"></i> Delete</button>
                        </td>
                    </tr>           
            `
    );
    userActionElements.createName.value = "";
    userActionElements.createUserName.value = "";
    userActionElements.createGroup.value = "User";
    userActionElements.createPassword.value = "";
    userActionElements.createPassword2.value = "";
    $("#userCreateModal").modal("hide");
    document.getElementById(`deleteUserBtn-${createdUser._id}`).addEventListener("click", (e) => {
      deleteUser(createdUser._id);
    });
    document
      .getElementById(`resetPasswordBtn-${createdUser._id}`)
      .addEventListener("click", (e) => {
        userActionElements.resetPasswordFooter.innerHTML = `
        ${returnSaveBtn()}
        `;
        const userActionSave = document.getElementById("userActionSave");
        userActionSave.addEventListener("click", async () => {
          await resetUserPassword(createdUser._id);
        });
      });
    document
      .getElementById(`editUserBtn-${createdUser._id}`)
      .addEventListener("click", async (e) => {
        userActionElements.editUserFooter.innerHTML = `
        ${returnSaveBtn()}
        `;
        await fillInEditInformation(createdUser._id);
        const userActionSave = document.getElementById("userActionSave");
        userActionSave.addEventListener("click", async () => {
          await editUser(createdUser._id);
        });
      });
    UI.createAlert("success", "Successfully created your user!", 3000, "clicked");
  }
}

async function fillInEditInformation(id) {
  let editInformation = await OctoFarmClient.getUser(id);
  userActionElements.editName.value = editInformation.name;
  userActionElements.editUserName.value = editInformation.username;
  userActionElements.editGroup.value = editInformation.group;
}

async function editUser(id) {
  userActionElements.userEditMessage.innerHTML = "";
  const newUserInfo = {
    name: userActionElements.editName.value,
    username: userActionElements.editUserName.value,
    group: userActionElements.editGroup.value
  };
  const editedUser = await OctoFarmClient.editUser(id, newUserInfo);
  if (editedUser.errors.length > 0) {
    editedUser.errors.forEach((error) => {
      userActionElements.userCreateMessage.insertAdjacentHTML(
        "beforeend",
        `
        <div class="alert alert-warning text-dark" role="alert">
          <i class="fas fa-exclamation-triangle"></i> ${error.msg}
        </div>
        `
      );
    });
  } else {
    UI.createAlert("success", "Successfully updated your user!", 3000, "clicked");
    userActionElements.editName.value = "";
    userActionElements.editUserName.value = "";
    userActionElements.editGroup.value = "User";
    $("#userEditModal").modal("hide");
  }
}

function deleteUser(id) {
  bootbox.confirm({
    message: "This action is unrecoverable, are you sure?",
    buttons: {
      confirm: {
        label: "Yes",
        className: "btn-success"
      },
      cancel: {
        label: "No",
        className: "btn-danger"
      }
    },
    callback: async function (result) {
      if (result) {
        const deletedUser = await OctoFarmClient.deleteUser(id);
        if (deletedUser.errors.length > 0) {
          deletedUser.errors.forEach((error) => {
            UI.createAlert("error", error.msg, 3000, "clicked");
          });
        } else {
          document.getElementById(`userRow-${deletedUser.userDeleted._id}`).remove();
          UI.createAlert("success", "Successfully deleted your user!", 3000, "clicked");
        }
      }
    }
  });
}

async function resetUserPassword(id) {
  userActionElements.userResetMessage.innerHTML = "";
  const newPassword = {
    password: userActionElements.resetPassword.value,
    password2: userActionElements.resetPassword2.value
  };
  let resetPassword = await OctoFarmClient.resetUserPassword(id, newPassword);
  if (resetPassword.errors.length > 0) {
    resetPassword.errors.forEach((error) => {
      userActionElements.userResetMessage.insertAdjacentHTML(
        "beforeend",
        `
        <div class="alert alert-warning text-dark" role="alert">
          <i class="fas fa-exclamation-triangle"></i> ${error.msg}
        </div>
        `
      );
    });
  } else {
    UI.createAlert("success", "Successfully reset your users password!", 3000, "clicked");
    userActionElements.resetPassword.value = "";
    userActionElements.resetPassword2.value = "";
    $("#usersResetPasswordModal").modal("hide");
  }
}

export {
  setupOPTimelapseSettings,
  generateLogDumpFile,
  nukeDatabases,
  exportDatabases,
  restartOctoFarmServer,
  checkFilamentManagerPluginState,
  updateServerSettings,
  updateOctoFarmCommand,
  checkForOctoFarmUpdates,
  grabOctoFarmLogList,
  renderSystemCharts,
  startUpdateTasksRunner,
  startUpdateInfoRunner,
  createNewUser,
  editUser,
  deleteUser,
  resetUserPassword,
  fillInEditInformation,
  setupOPFilamentManagerPluginSettings
};
