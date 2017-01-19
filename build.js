const spawn = require("child_process").spawnSync
const fs = require("fs")

//
// Constants
//

const Platform = {
  MAC_OS: "darwin",
  WINDOWS: "win32"
}

const COMMAND_SUCCEEDED = true
const COMMAND_FAILED = false

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
// Helpers
//

function enumerate_commands() {
  for (let command in commands) {
    console.log(`\t${command} - ${commands[command].desc}`)
  }
}

function run_through_commands_until_failure(op_objects) {
  for (let i = 0; i < op_objects.length; ++i) {
    console.log(op_objects[i].desc)
    const op_result = op_objects[i].op()
    if (op_result === COMMAND_FAILED) {
      console.log(`Error at operation: ${op_objects[i].desc}`)
      return COMMAND_FAILED
    }
  }
  
  return COMMAND_SUCCEEDED
}

function rm_rf(path) {
  let file_stats
  try {
    file_stats = fs.lstatSync(path)
  }
  catch (e) {
    return COMMAND_FAILED
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
  else if (file_stats.isFile() || file_stats.isSymbolicLink()) {
    // delete the file at the specified path
    fs.unlinkSync(path)
  }

  return COMMAND_SUCCEEDED
}

function run_shell(args_to_spawn) {
  // the arguments to spawn are (<executable name>, <command line args>, <options>)
  // and we want <options> to have its "shell" property set to true 
  // so spawn will run the command in a shell environment
  args_to_spawn_array = []
  for (let i = 0; i < arguments.length; ++i) {
    args_to_spawn_array.push(arguments[i])
  }
  
  switch (args_to_spawn_array.length) {
  case 0:
    // zero arguments is invalid because we don't know what executable we're launching
    console.log("No arguments to provide to spawn!")
    return COMMAND_FAILED
      
  case 1:
    // if the user didn't provide any command line args, just give spawn an empty array for them
    args_to_spawn_array.push([])
    // intentional fallthrough
      
  case 2:
    // if the user didn't provide any options, we at least need "shell" to be true 
    args_to_spawn_array.push({ shell: true })
    // intentional fallthrough
      
  default:
    // display actual command we're attempting to run in the shell
    const shell_string = [args_to_spawn_array[0]].concat(args_to_spawn_array[1]).join(" ")
    console.log(shell_string)

    const result = spawn.apply(null, args_to_spawn_array)
    if (result.error || result.status !== 0) {
      console.log("Error:")
      console.log(result.error)
      console.log("")
      console.log("stderr:")
      console.log(`${result.stderr}`)
      return COMMAND_FAILED
    }
    
    console.log(`${result.stdout}`)
    return COMMAND_SUCCEEDED
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
    "--arch=x64", 
    "--version", "1.3.3",
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
    return COMMAND_FAILED
  }
  
  return COMMAND_SUCCEEDED
}

function package_for_platform(executable_name, platform) {
  return run_through_commands_until_failure([
    { desc: "run elm make",            op: () => run_elm_make() },
    { desc: "make dist folder",        op: () => { fs.mkdirSync(`${process.cwd()}/dist`); return COMMAND_SUCCEEDED } },
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
// Main
//

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