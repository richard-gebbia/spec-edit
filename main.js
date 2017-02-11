const {app, BrowserWindow, dialog, Menu} = require('electron')
const ipc = require('electron').ipcMain
const fs = require('fs')
const os = require('os')
const cp = require('child_process')

//
// Globals
//

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

// The name of the spec file that's currently being edited. This is primarily 
// used so that the "save" command can write to a file without asking the user 
// for a filename.
let currentFileName = null

const isWindows = process.platform.startsWith("win")


//
// Electron window initialization
//

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 1024, height: 768})

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`)

  // Open the DevTools. (uncomment this for debugging purposes)
  // win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Drop the reference to the window object
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
  
  // On Windows there's a chance that we made a specific temp directory
  // for diffs. On close we should delete that directory and its contents.
  if (isWindows) {
    const rm_rf = (path) => {
      try {
        const pathStats = fs.statsSync(path)
      } catch (e) {
        // if there was an error opening the path, it's likely that the path doesn't exist
        // so we should just do nothing in that case
        return
      }
      
      if (pathStats.isDirectory()) {
        const files = fs.readdirSync(path)
        for (let i = 0; i < files.length; ++i) {
          rm_rf(path)
        }
        fs.rmdir(path)
      } else if (pathStats.isFile()) {
        fs.unlinkSync(path)
      }
    }
    
    rm_rf("temp")
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})


//
// Build the menus
//

const fileTypeFilters = [
  { name: 'JSON', extensions: ['json'] }
]

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

// On macOS, applications tend to have a menu item before "File"
// that's the name of the application, which has a couple standard
// submenus like "About" and "Quit"
if (process.platform === 'darwin') {
  let appNameMenuItems = []

  // add update menu items  unless this is the Mac App Store build,
  // because the app store handles update UI
  if (!process.mas) {
    const version = require('electron').app.getVersion()
    appNameMenuItems = appNameMenuItems.concat({
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
    })
  }

  const name = require('electron').app.getName()

  // these are standard items in the "app name" menu for Mac applications
  appNameMenuItems = appNameMenuItems.concat({
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
  })

  template.unshift({
    label: name,
    submenu: appNameMenuItems
  })
}

app.on('ready', () => {
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
})


//
// Handle events from the Elm app
//

ipc.on('spec-json', (event, filename, specJson) => {
  // TODO(Richard): add a callback to handle write errors
  fs.writeFile(filename, specJson)
})

function platformSpacesAndSlashes(filename) {
  if (isWindows) {
    if (filename.search(" ") !== -1) {
      filename = '"' + filename + '"'
    }
    filename = filename.replace("/", "\\")
  }

  return filename.replace(/\s/gi, "\\ ")
}

ipc.on('diff-json', (event, oldSpecFilename, specJson) => {
  // generate a filename for the spec that's currently being edited
  let newSpecFilename
  if (isWindows) {
    try {
      fs.statSync("temp")
    } catch (e) {
      // if "temp" doesn't exist, control flow will end up here
      fs.mkdirSync("temp")
    }
    newSpecFilename = "temp\\diff-spec-temp.json"
  } else {
    newSpecFilename = platformSpacesAndSlashes(`${os.tmpdir()}/diff-spec-temp.json`)
  }
  
  // write it out to a temp file (that should be deleted upon closing the program)
  win.webContents.send('log-debug', newSpecFilename)
  fs.writeFile(newSpecFilename, specJson, (err) => {
    if (err) {
      console.log(err)
      win.webContents.send('log-debug', err)
      return
    }

    // make a file to save the diff to
    dialog.showSaveDialog({
      title: 'Save Diff as...',
      filters: fileTypeFilters
    }, (filename) => {
      if (!filename) return
      
      let command = platformSpacesAndSlashes(__dirname + "/spec")
      oldSpecFilename = platformSpacesAndSlashes(oldSpecFilename)
      
      // Windows is stupid and if there is a space in the command, 
      // then it MUST be executed via a shell.
      const exec = (isWindows && command.search(" ") !== -1) ? cp.exec : cp.execFile

      exec(command, ["diff", "--spec1", oldSpecFilename, "--spec2", newSpecFilename], { 
        encoding: 'utf8'
      }, (err, stdout, stderr) => {
        if (err) {
          console.log(err)
          win.webContents.send('log-debug', err)
          win.webContents.send('log-debug', stdout)
          return
        }

        fs.writeFile(filename, stdout)
      })
    })
  })
})