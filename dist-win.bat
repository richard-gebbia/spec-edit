call build.bat
md dist
copy elm.js dist\elm.js
copy elmelectron.js dist\elmelectron.js
copy index.html dist\index.html
copy main.js dist\main.js
copy package.json dist\package.json
copy spec.exe dist\spec.exe
copy spec.css dist\spec.css
electron-packager dist spec-edit --platform=win32 --arch=x64 --version 1.3.3 --out=dist\out