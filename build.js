const spawn = require("child_process").spawnSync
const fs = require("fs")

//
// Shortcircuit on failure
//

function shortcircuit_on_failure(op_objects) {
  for (let i = 0; i < op_objects.length; ++i) {
    const op_was_successful = op_objects[i].op()
    if (!op_was_successful) {
      console.log(`Error at operation: ${op_objects[i].desc}`)
      return false
    }
  }
  
  return true
}

//
// Platforms
//

const Platform = {
  MAC_OS: "darwin",
  WINDOWS: "win32"
}

//
// Helpers
//

function rm_rf(path) {
  let file_stats
  try {
    file_stats = fs.statSync(path)
  }
  catch (e) {
    return
  }
  
  if (file_stats.isDirectory()) {
    // delete all the files in the directory
    const files = fs.readdirSync(path)
    for (let i = 0; i < files.length; ++i) {
      rm_rf(`${path}/${files[i]}`)
    }
    
    // and then delete the directory
    fs.rmdirSync(path)
  }
  else if (file_stats.isFile()) {
    // delete the file at the specified path
    fs.unlinkSync(path)
  }
}

function run_shell(args_to_spawn) {
  args_to_spawn_array = []
  for (let i = 0; i < arguments.length; ++i) {
    args_to_spawn_array.push(arguments[i])
  }
  
  switch (args_to_spawn_array.length) {
  case 0:
    console.log("No arguments to provide to spawn!")
    return false
      
  case 1:
    args_to_spawn_array.push([])
    // intentional fallthrough
      
  case 2:
    args_to_spawn_array.push({ shell: true })
    // intentional fallthrough
      
  default:
    const result = spawn.apply(null, args_to_spawn_array)
    if (result.error || result.status !== 0) {
      console.log("Error:")
      console.log(result.error)
      console.log("")
      console.log("stderr:")
      console.log(`${result.stderr}`)
      return false
    }
    
    console.log(`${result.stdout}`)
    return true
  }
}

function run_elm_make() {
  return run_shell("elm-make", ["Spec.elm", "--output=elm.js", "--yes"])
}

function run_electron_packager(platform) {
  return run_shell("electron-packager", [
    "dist",
    "spec-edit",
    `--platform=${platform}`,
    "--arch=x64", "--version",
    "1.3.3",
    "--out=dist/out"
  ])
}

function copy_file(source, dest) {
  try {
    const source_contents = fs.readFileSync(source)
    fs.writeFileSync(dest, source_contents)
  } 
  catch (err) {
    console.log(err)
    return false
  }
  
  return true
}

function package_for_platform(executable_name, platform) {
  return shortcircuit_on_failure([
    { desc: "run elm make",            op: () => run_elm_make() },
    { desc: "make dist folder",        op: () => { fs.mkdirSync(`${process.cwd()}/dist`); return true } },
    { desc: "copy elm.js",             op: () => copy_file("elm.js", "dist/elm.js") },
    { desc: "copy elmelectron.js",     op: () => copy_file("elmelectron.js", "dist/elmelectron.js") },
    { desc: "copy index.html",         op: () => copy_file("index.html", "dist/index.html") },
    { desc: "copy main.js",            op: () => copy_file("main.js", "dist/main.js") },
    { desc: "copy package.json",       op: () => copy_file("package.json", "dist/package.json") },
    { desc: `copy ${executable_name}`, op: () => copy_file(executable_name, `dist/${executable_name}`) },
    { desc: "copy spec.css",           op: () => copy_file("spec.css", "dist/spec.css") },
    { desc: "run electron_packager",   op: () => run_electron_packager(platform) }
  ])
}

//
// Commands
//

const commands = {
  "all": {
    run: () => {
      run_elm_make()
    },
    desc: "Build the elm project for local development"
  },
  
  "clean": {
    run: () => {
      function show_delete(path) {
        console.log(`Deleting ${path}`)
        rm_rf(path)
      }
      
      show_delete("elm.js") 
      show_delete("elm-stuff/build-artifacts")
      show_delete("dist")
    },
    desc: "Delete all build artifacts"
  },
  
  "dist-mac": {
    run: () => package_for_platform("spec", Platform.MAC_OS),
    desc: "Build and package application for macOS"
  },
  
  "dist-win": {
    run: () => package_for_platform("spec.exe", Platform.WINDOWS),
    desc: "Build and package application for Windows"
  }
}

//
// Main
//

function enumerate_commands() {
  for (let command in commands) {
    console.log(`\t${command} - ${commands[command].desc}`)
  }
}

// if the command is: "node build.js all",
// then argv would look like ["node", "build.js", "all"]
if (process.argv.length < 3) {
  console.log("Please select an option to build. Options are:")
  enumerate_commands() 
  return
}

const command = process.argv[2]
if (!commands[command] || !(commands[command].run)) {
  console.log(`Invalid command ${command}`)
  console.log("Please select a valid command. Options are:")
  enumerate_commands()
  return
}

commands[command].run()