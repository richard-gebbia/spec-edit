cabal_version = Cabal-1.22.5.0

all:
	elm make Spec.elm --output=elm.js

spec:
	cd spec-hs && stack build
	cp spec-hs/.stack-work/dist/x86_64-osx/${cabal_version}/build/spec/spec spec

dist-mac:
	elm make Spec.elm --output=elm.js
	cd spec-hs && stack build
	cp spec-hs/.stack-work/dist/x86_64-osx/${cabal_version}/build/spec/spec spec
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
	git clean -f -d