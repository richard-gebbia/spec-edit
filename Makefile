all:
	elm make Spec.elm --output=elm.js

dist-mac:
	elm make Spec.elm --output=elm.js
	mkdir -p dist
	cp elm.js dist/elm.js
	cp elmelectron.js dist/elmelectron.js
	cp index.html dist/index.html
	cp main.js dist/main.js
	cp package.json dist/package.json
	cp spec dist/spec
	cp spec.css dist/spec.css
	electron-packager dist spec-edit --platform=darwin --arch=x64 --version 1.3.3 --out=dist/out

clean:
	rm elm.js
	rm -r elm-stuff/build-artifacts
	rm -r dist