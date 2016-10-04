all:
	elm make Spec.elm --output=elm.js

clean:
	rm elm.js
	rm -r elm-stuff/build-artifacts