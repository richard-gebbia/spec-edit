const {app, BrowserWindow, dialog, Menu} = require('electron')
const ipc = require('electron').ipcMain
const fs = require('fs')
const os = require('os')
const execFile = require('child_process').execFile

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 1024, height: 768})

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`)

  // Open the DevTools.
  // win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

let fileTypeFilters = [
  { name: 'JSON', extensions: ['json'] }
]

let currentFileName = null

// File menu
let template = [{
  label: 'File',
  submenu: [{
    label: 'Open...',
    accelerator: 'CmdOrCtrl+O',
    role: 'open',
    click(item, focusedWindow) {
      dialog.showOpenDialog({
        properties: ['openFile']
      }, (files) => {
        if (!files) return

        fs.readFile(files[0], 'utf8', (err, data) => {
          if (err) {
            console.log(err)
            return
          }

          currentFileName = files[0]
          win.webContents.send('open-spec', data)
        })
      })
    }
  }, {
    label: 'Save',
    accelerator: 'CmdOrCtrl+S',
    role: 'save',
    click(item, focusedWindow) {
      if (!currentFileName) return

      win.webContents.send('save-spec', currentFileName)
    }
  }, {
    label: 'Save As...',
    accelerator: 'CmdOrCtrl+Shift+S',
    role: 'save-as',
    click(item, focusedWindow) {
      dialog.showSaveDialog({
        title: 'Save spec file',
        filters: fileTypeFilters
      }, (filename) => {
        if (!filename) return

        win.webContents.send('save-spec', filename)
      })
    }
  }, {
    label: 'Diff with...',
    role: 'diff',
    click(item, focusedWindow) {
      dialog.showOpenDialog({
        title: 'Open file to diff against',
        properties: ['openFile'],
        filters: fileTypeFilters
      }, (files) => {
        if (!files) return

        win.webContents.send('diff-spec', files[0])
      })
    }
  }]
}, {
  label: "Edit",
  submenu: [{ 
    label: "Undo",
    accelerator: "CmdOrCtrl+Z",
    click(item, focusedWindow) {
      win.webContents.send('undo')
    }
  }, {
    label: "Redo",
    accelerator: "Shift+CmdOrCtrl+Z",
    click(item, focusedWindow) {
      win.webContents.send('redo')
    }
  }, { 
    type: "separator" 
  }, {
    label: "Cut",
    accelerator: "CmdOrCtrl+X",
    selector: "cut:"
  }, {
    label: "Copy",
    accelerator: "CmdOrCtrl+C",
    selector: "copy:"
  }, {
    label: "Paste",
    accelerator: "CmdOrCtrl+V",
    selector: "paste:"
  }, {
    label: "Select All",
    accelerator: "CmdOrCtrl+A", 
    selector: "selectAll:" 
  }]
}]

// thanks, Electron
function addUpdateMenuItems (items, position) {
  if (process.mas) return

  const version = require('electron').app.getVersion()
  let updateItems = [{
    label: `Version ${version}`,
    enabled: false
  }, {
    label: 'Checking for Update',
    enabled: false,
    key: 'checkingForUpdate'
  }, {
    label: 'Check for Update',
    visible: false,
    key: 'checkForUpdate',
    click: () => {
      require('electron').autoUpdater.checkForUpdates()
    }
  }, {
    label: 'Restart and Install Update',
    enabled: true,
    visible: false,
    key: 'restartToUpdate',
    click: function () {
      require('electron').autoUpdater.quitAndInstall()
    }
  }]

  items.splice.apply(items, [position, 0].concat(updateItems))
}

if (process.platform === 'darwin') {
  const name = require('electron').app.getName()
  template.unshift({
    label: name,
    submenu: [{
      label: `About ${name}`,
      role: 'about'
    }, {
      type: 'separator'
    }, {
      label: 'Services',
      role: 'services',
      submenu: []
    }, {
      type: 'separator'
    }, {
      label: `Hide ${name}`,
      accelerator: 'Command+H',
      role: 'hide'
    }, {
      label: 'Hide Others',
      accelerator: 'Command+Alt+H',
      role: 'hideothers'
    }, {
      label: 'Show All',
      role: 'unhide'
    }, {
      type: 'separator'
    }, {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => {
        app.quit()
      }
    }]
  })

  addUpdateMenuItems(template[0].submenu, 1)
}

app.on('ready', () => {
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
})

ipc.on('spec-json', (event, filename, specJson) => {
  // TODO(Richard): add a callback to handle write errors
  fs.writeFile(filename, specJson)
})

function platformSpaces(filename) {
  if (process.platform.startsWith("win")) {
    return '"' + filename + '"'
  }

  return filename.replace(/\s/gi, "\\ ")
}

ipc.on('diff-json', (event, oldSpecFilename, specJson) => {
  let newSpecFilename = `${os.tmpdir()}/diff-spec-temp.json`
  fs.writeFile(newSpecFilename, specJson, (err) => {
    if (err) {
      console.log(err)
      return
    }

    dialog.showSaveDialog({
      title: 'Save Diff as...',
      filters: fileTypeFilters
    }, (filename) => {
      if (!filename) return

      execFile(process.cwd() + "/spec", ["diff", "--spec1", platformSpaces(`${oldSpecFilename}`), "--spec2", platformSpaces(`${newSpecFilename}`)], { 
        encoding: 'utf8'
      }, (err, stdout, stderr) => {
        if (err) {
          console.log(err)
          return
        }

        fs.writeFile(filename, stdout)
      })
    })
  })
})