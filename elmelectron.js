const ipc = require('electron').ipcRenderer

var elmApp = Elm.Spec.fullscreen({
  title: "Untitled",
  nextUid: 0,
  features: []
});

elmApp.ports.saveSpec.subscribe((saveInfo) => {
  ipc.send('spec-json', saveInfo.filename, saveInfo.specJson)
})

elmApp.ports.diffSpec.subscribe((diffInfo) => {
  ipc.send('diff-json', diffInfo.filename, diffInfo.specJson)
})

elmApp.ports.focus.subscribe((idToFocus) => {
  let elToFocus = document.getElementById(idToFocus)

  if (!elToFocus) {
    elmApp.ports.requestRedraw.send([])
  }
  else {
    elToFocus.focus()
  }
})

ipc.on('log-debug', (event, data) => {
  console.log(data)
})

ipc.on('open-spec', (event, spec) => {
  elmApp.ports.loadSpec.send(spec)
})

ipc.on('save-spec', (event, filename) => {
  elmApp.ports.saveSpecTrigger.send(filename)
})

ipc.on('diff-spec', (event, filename) => {
  elmApp.ports.diffSpecTrigger.send(filename)
})

ipc.on('undo', (event) => {
  elmApp.ports.undo.send([])
})

ipc.on('redo', (event) => {
  elmApp.ports.redo.send([])
})