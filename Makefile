
# linkeddata git space
L=..

update:
	(cd $L/tabulator-firefox/content/js/mashup/; rm mashlib.js; make mashlib.js);
	cp $L/tabulator-firefox/content/js/mashup/mashlib.js .
	

mashlib.js: $L/tabulator-firefox/content/js/mashup/mashlib.js 
	cp $L/tabulator-firefox/content/js/mashup/mashlib.js .

