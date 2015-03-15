/*jQuery.ajaxPrefilter(function(options) {
    if (options.crossDomain) {
        options.url = "https://w3.scripts.mit.edu/proxy?uri=" + encodeURIComponent(options.url);
    }
});
*/
var OriginalSource = document.children ? document.children[0].outerHTML : // Chrome
            document.childNodes[1].outerHTML; // Safari
            
jQuery(document).ready(function() {


    var appPathSegment = 'app-when-can-we.w3.org'; // how to allocate this string and connect to 
    
    
    //////////////////////////////////////////////

    var kb = tabulator.kb;
    var fetcher = tabulator.sf;
    var ns = tabulator.ns;
    var dom = document;
    var updater = new $rdf.sparqlUpdate(kb);
    var waitingForLogin = false;

    var ICAL = $rdf.Namespace('http://www.w3.org/2002/12/cal/ical#');
    var SCHED = $rdf.Namespace('http://www.w3.org/ns/pim/schedule#');
    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
    var UI = $rdf.Namespace('http://www.w3.org/ns/ui#');
    var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
    
    var uri = window.location.href;
    var base = window.document.title = uri.slice(0, uri.lastIndexOf('/')+1);
    var subject_uri = base  + 'details.ttl#event1';
    var forms_uri = window.document.title = base+ 'forms.ttl';


    var subject = kb.sym(subject_uri);
    var thisInstance = subject;
    var detailsDoc = kb.sym(subject_uri.split('#')[0]);
         
    var resultsDoc = $rdf.sym(base + 'results.ttl');
    
    
    // kb.fetcher.nowOrWhenLoaded(kb.sym(data_uri2), undefined, function(ok, body) {
    // });
        
    var form1 = kb.sym(forms_uri + '#form1');
    var form2 = kb.sym(forms_uri + '#form2');
    var form3 = kb.sym(forms_uri + '#form3');
    
    // tabulator.outline.GotoSubject(subject, true, undefined, true, undefined);
    
    var div = document.getElementById('FormTarget');
    
    // Utility functions
    
    var say = function(message) {
    };
    
    var complainIfBad = function(ok, message) {
        if (!ok) {
            div.appendChild(tabulator.panes.utils.errorMessageBlock(dom, message, 'pink'));
        }
    };
    
    var clearElement = function(ele) {
        while (ele.firstChild) {
            ele.removeChild(ele.firstChild);
        }
        return ele;
    }
    
    var webOperation = function(method, uri, options, callback) {
        var xhr = $rdf.Util.XMLHTTPFactory();
        xhr.onreadystatechange = function (){
            if (xhr.readyState == 4){
                var success = (!xhr.status || (xhr.status >= 200 && xhr.status < 300));
                callback(uri, success, xhr.responseText, xhr);
            }
        };
        xhr.open(method, uri, true);
        if (options.contentType) {
            xhr.setRequestHeader('Content-type', options.contentType);
        }
        xhr.send(options.data ? options.data : undefined);
    };
    
    var webCopy = function(here, there, content_type, callback) {
        webOperation('GET', here,  {}, function(uri, success, body, xhr) {
            if (success) {
                webOperation('PUT', there, { data: xhr.responseText, contentType: content_type}, callback);
            } else {
                callback(uri, success, "(on read) " + body, xhr);
            }
        });
    };
    
          

    ////////////////////////////////////// Getting logged in with a WebId
    
    var setUser = function(webid) {
        if (webid) {
            tabulator.preferences.set('me', webid);
            console.log("(SetUser: Logged in as "+ webid+")")
            me = kb.sym(webid);
            // @@ Here enable all kinds of stuff
        } else {
            tabulator.preferences.set('me', '');
            console.log("(SetUser: Logged out)")
            me = null;
        }
        if (logInOutButton) { 
            logInOutButton.refresh();  
        }
        if (webid && waitingForLogin) {
            waitingForLogin = false;
            showAppropriateDisplay();
        }
    }
    
    var me_uri = tabulator.preferences.get('me');
    var me = me_uri? kb.sym(me_uri) : null;
    tabulator.panes.utils.checkUser(detailsDoc, setUser);
        

    ////////////////////////////////  Reproduction: spawn a new instance
    //
    // Viral growth path: user of app decides to make another instance
    //

    var newInstanceButton = function() {
        return tabulator.panes.utils.newAppInstance(dom, "Schedule another event",
                    initializeNewInstanceInWorkspace);
    }; // newInstanceButton




    /////////////////////////  Create new document files for new instance of app

    var initializeNewInstanceInWorkspace = function(ws) {
        var newBase = kb.any(ws, ns.space('uriPrefix')).value;
        if (!newBase) {
            newBase = ws.uri.split('#')[0];
        }
        if (newBase.slice(-1) !== '/') {
            $rdf.log.error(appPathSegment + ": No / at end of uriPrefix " + newBase ); // @@ paramater?
            newBase = newBase + '/';
        }
        var now = new Date();
        newBase += appPathSegment + '/id'+ now.getTime() + '/'; // unique id 
        
        initializeNewInstanceAtBase(thisInstance, newBase);
    }

    var initializeNewInstanceAtBase = function(thisInstance, newBase) {

        var here = $rdf.sym(thisInstance.uri.split('#')[0]);

        var sp = tabulator.ns.space;
        var kb = tabulator.kb;
        
        
        newDetailsDoc = kb.sym(newBase + 'details.ttl');
        newResultsDoc = kb.sym(newBase + 'results.ttl');
        newIndexDoc = kb.sym(newBase + 'index.html');
        /*
        newScriptDoc = kb.sym(newBase + 'schedule.js');
        newFormsDoc = kb.sym(newBase + 'forms.ttl');
        */
        toBeCopied = [
            { local: 'index.html', contentType: 'text/html'} ,
            { local: 'forms.ttl', contentType: 'text/turtle'} ,
            { local: 'schedule.js', contentType: 'application/javascript'} ,
            { local: 'mashlib.js', contentType: 'application/javascript'} , //  @@ centrialize after testing?
        ];
        
        newInstance = kb.sym(newDetailsDoc.uri + '#event');
        kb.add(newInstance, ns.rdf('type'), SCHED('SchedulableEvent'), newDetailsDoc);
        if (me) {
            kb.add(newInstance, DC('author'), me, newDetailsDoc);
        }
        
        kb.add(newInstance, DC('created'), new Date(), newDetailsDoc);
        kb.add(newInstance, SCHED('resultsDocument'), newDetailsDoc);
        
        // Keep a paper trail   @@ Revisit when we have non-public ones @@ Privacy
        kb.add(newInstance, tabulator.ns.space('inspiration'), thisInstance, detailsDoc);            
        kb.add(newInstance, tabulator.ns.space('inspiration'), thisInstance, newDetailsDoc);
        
        // $rdf.log.debug("\n Ready to put " + kb.statementsMatching(undefined, undefined, undefined, there)); //@@


        agenda = [];
        agenda.push(function createDetailsFile(){
            updater.put(
                newDetailsDoc,
                kb.statementsMatching(undefined, undefined, undefined, newDetailsDoc),
                'text/turtle',
                function(uri2, ok, message) {
                    if (ok) {
                        agenda.shift()();
                    } else {
                        complainIfBad(ok, "FAILED to save new scheduler at: "+ there.uri +' : ' + message);
                        console.log("FAILED to save new scheduler at: "+ there.uri +' : ' + message);
                    };
                }
            );
        });

        var f, fi, fn;
        for (f=0; f < toBeCopied.length; f++) {
            var item = toBeCopied[f];
            var fun = function copyItem(item) {
                agenda.push(function(){
                    console.log("Copying " + base + item.local + " to " +  newBase + item.local);
                    webCopy(base + item.local, newBase + item.local, item.contentType, function(uri, ok, message, xhr) {
                        if (!ok) {
                            complainIfBad(ok, "FAILED to copy "+ base + item.local +' : ' + message);
                            console.log("FAILED to copy "+ base + item.local +' : ' + message);
                        } else {
                            agenda.shift()(); // beware too much nesting
                        }
                    });
                });
            };
            fun(item);
        };

        agenda.push(function(){  // give the user links to the new app
        
            var p = div.appendChild(dom.createElement('p'));
            p.innerHTML = 
                "Your <a href='" + newIndexDoc.uri + "'><b>new scheduler</b></a> is ready to be set up. "+
                "<br/><br/><a href='" + newIndexDoc.uri + "'>Say when you what days work for you.</a>";
            });
        
        agenda.shift()();        
        // Created new data files.
    }



    /////////////////////////


    var getForms = function () {
        fetcher.nowOrWhenFetched(forms_uri, undefined, function(ok, body){
            if (!ok) return complainIfBad(ok, body);
            getDetails();
        });
    };
    
    var getDetails = function() {
        fetcher.nowOrWhenFetched(detailsDoc.uri, undefined, function(ok, body){
            if (!ok) return complainIfBad(ok, body);
            showAppropriateDisplay();
        });
    };
    
    var showAppropriateDisplay = function() {
        // On gh-pages, the turtle will not load properly 
        // but we can trap it as being a non-editable server.
        if (!tabulator.sparql.editable(detailsDoc.uri, kb) ||
            kb.holds(subject, ns.rdf('type'), ns.wf('TemplateInstance'))) {
            // This is read-only example e.g. on github pages, etc
            showBootstrap(div);
            return;
        }
        var me_uri = tabulator.preferences.get('me');
        var me = me_uri? kb.sym(me_uri) : null;
        
        if (!me) {
            var p = div.appendChild(dom.createElement('p'));
            p.textContent = 'You need to be logged in.';
            waitingForLogin = true; // hack
        } else {
        
            var ready = kb.any(subject,  SCHED('ready'));
//            var author = kb.any(subject, DC('author'));
//            if (me && (!author || me.sameTerm(author))) { // Allow  editing of tuff  was: && author && me.sameTerm(author)
            if (!ready) {
                showForms();
            } else { // no editing not author
                getResults();
            }
        };
    };
    
    var showBootstrap = function showBootstrap() {
        var div = clearElement(naviMain);
        var na = div.appendChild(tabulator.panes.utils.newAppInstance(
            dom, "Start a new poll in a workspace", initializeNewInstanceInWorkspace));
        
        var hr = div.appendChild(dom.createElement('hr')); // @@
        
        var p = div.appendChild(dom.createElement('p'));
        p.textContent = "Where would you like to store the data for the poll?  " +
        "Give the URL of the directory where you would like the data stored.";
        var baseField = div.appendChild(dom.createElement('input'));
        baseField.setAttribute("type", "text");
        baseField.size = 80; // really a string
        baseField.label = "base URL";
        baseField.autocomplete = "on";

        div.appendChild(dom.createElement('br')); // @@
        
        var button = div.appendChild(dom.createElement('button'));
        button.textContent = "Start new poll at this URI";
        button.addEventListener('click', function(e){
            var newBase = baseField.value;
            if (newBase.slice(-1) !== '/') {
                newBase += '/';
            }
            initializeNewInstanceAtBase(thisInstance, newBase);
        });
    } 
          
    /////////////// The forms to configure the poll
    
    var showForms = function() {

        var div = naviMain;
        var wizard = true;
        var currentSlide = 0;
        var gotDoneButton = false;
        if (wizard) {
        
            forms = [ form1, form2, form3 ];
            slides = [];
            var slide, currentSlide = 0;
            for (var f=0; f<forms.length; f++) {
                slide = dom.createElement('div');
                tabulator.panes.utils.appendForm(document, slide, {}, subject, forms[f], detailsDoc, complainIfBad);
                slides.push(slide);
            }

            var refresh = function() {
                clearElement(naviMain).appendChild(slides[currentSlide]);
                
                if (currentSlide === 0) {
                    b1.setAttribute('disabled', '');
                } else {
                    b1.removeAttribute('disabled');
                }
                if (currentSlide === slides.length - 1 ) {
                    b2.setAttribute('disabled', '');
                    if (!gotDoneButton) { // Only expose at last slide seen
                        naviCenter.appendChild(doneButton); // could also check data shape
                        gotDoneButton = true;
                    }
                } else {
                    b2.removeAttribute('disabled');
                }
                
            }
            var b1 = clearElement(naviLeft).appendChild(dom.createElement('button'));
            b1.textContent = "<- go back";
            b1.addEventListener('click', function(e) {
                if (currentSlide > 0) {
                    currentSlide -= 1;
                    refresh();
                } 
            }, false);

            
            var b2 = clearElement(naviRight).appendChild(dom.createElement('button'));
            b2.textContent = "continue ->";
            b2.addEventListener('click', function(e) {
                if (currentSlide < slides.length - 1) {
                    currentSlide += 1;
                    refresh();
                } 
            }, false);

            refresh();
            
        } else { // not wizard one big form
            // @@@ create the initial config doc if not exist
            var table = div.appendChild(dom.createElement('table'));
            tabulator.panes.utils.appendForm(document, table, {}, subject, form1, detailsDoc, complainIfBad);
            //table.appendChild(dom.createElement('p')).textContent = "Pick some dates which would work for you.";
            tabulator.panes.utils.appendForm(document, table, {}, subject, form2, detailsDoc, complainIfBad);
            //table.appendChild(dom.createElement('p')).textContent = "Who will you invite to attend the event? Give their email addresses.";
            tabulator.panes.utils.appendForm(document, table, {}, subject, form3, detailsDoc, complainIfBad);
            naviCenter.appendChild(doneButton); // could also check data shape
           
        }
        // @@@  link config to results
        
        insertables = [];
        insertables.push($rdf.st(subject, SCHED('availabilityOptions'), SCHED('YesNoMaybe'), detailsDoc));
        insertables.push($rdf.st(subject, SCHED('ready'), new Date(), detailsDoc));
        insertables.push($rdf.st(subject, SCHED('results'), resultsDoc, detailsDoc)); // @@ also link in results
        
        var doneButton = dom.createElement('button');
        doneButton.textContent = "Done";
        doneButton.addEventListener('click', function(e) {
            if (kb.any(subject, SCHED('ready'))) { // already done
                getResults();
            } else {
                tabulator.sparql.update([], insertables, function(uri,success,error_body){
                    if (!success) {
                        complainIfBad(success, error_body);
                    } else {
                        getResults();
                    }
                });
            }
        }, false);
} // showForms
    
    
 
    // Read or create empty results file
    
    var getResults = function () {
        var div = naviMain;
        fetcher.nowOrWhenFetched(resultsDoc.uri, undefined, function(ok, body, xhr){
            if (!ok) {   
                if (0 + xhr.status === 404) { ///  Check explictly for 404 error
                    console.log("Initializing deails file " + resultsDoc)
                    updater.put(resultsDoc, [], 'text/turtle', function(uri2, ok, message, xhr) {
                        if (ok) {
                            kb.fetcher.saveRequestMetadata(xhr, kb, resultsDoc.uri);
                            kb.fetcher.saveResponseMetadata(xhr, kb); // Drives the isEditable question
                            clearElement(naviMain);
                            showResults();
                        } else {
                            complainIfBad(ok, "FAILED to create results file at: "+ resultsDoc.uri +' : ' + message);
                            console.log("FAILED to craete results file at: "+ resultsDoc.uri +' : ' + message);
                        };
                    });
                } else { // Other error, not 404 -- do not try to overwite the file
                    complainIfBad(ok, "FAILED to read results file: " + body)
                }
            } else { // Happy read
                clearElement(naviMain);
                showResults();
            }
        });
    };
    




    
    var showResults = function() {
    
        //       Now the form for responsing to the poll
        //

        // div.appendChild(dom.createElement('hr'))
        
        var invitation = subject;
        var title = kb.any(invitation, DC('title'));
        var comment = kb.any(invitation, ns.rdfs('comment'));
        var location = kb.any(invitation, ICAL('location'));
        var div = naviMain;
        if (title) div.appendChild(dom.createElement('h3')).textContent = title;
        if (location) div.appendChild(dom.createElement('address')).textContent = location.value;
        if (comment) div.appendChild(dom.createElement('p')).textContent = comment.value;
        var author = kb.any(invitation, DC('author'));
        if (author) {
            var authorName = kb.any(author, FOAF('name'));
            if (authorName) {
                div.appendChild(dom.createElement('p')).textContent = authorName;
            }
        }
         

        var query = new $rdf.Query('Responses');
        var v = {};
        ['time', 'author', 'value', 'resp', 'cell'].map(function(x){
             query.vars.push(v[x]=$rdf.variable(x))});
        query.pat.add(invitation, SCHED('response'), v.resp);
        query.pat.add(v.resp, DC('author'), v.author);
        query.pat.add(v.resp, SCHED('cell'), v.cell);
        query.pat.add(v.cell, SCHED('availabilty'), v.value);
        query.pat.add(v.cell, ICAL('dtstart'), v.time);
        
        // Sort by by person @@@
        
        
        var options = {};
        options.set_x = kb.each(subject, SCHED('option')); // @@@@@ option -> dtstart in future
        options.set_x = options.set_x.map(function(opt){return kb.any(opt, ICAL('dtstart'))});

        options.set_y = kb.each(subject, SCHED('response'));
        options.set_y = options.set_y.map(function(resp){return kb.any(resp, DC('author'))});

        var possibleTimes = kb.each(invitation, SCHED('option'))
            .map(function(opt){return kb.any(opt, ICAL('dtstart'))});

         var displayTheMatrix = function() {
            var matrix = div.appendChild(tabulator.panes.utils.matrixForQuery(
                dom, query, v.time, v.author, v.value, options, function(){})); 
            
            matrix.setAttribute('class', 'matrix');
            
            var refreshButton = dom.createElement('button');
            refreshButton.textContent = "refresh";
            refreshButton.addEventListener('click', function(e) {
                refreshButton.disabled = true;
                tabulator.sf.nowOrWhenFetched(subject_uri.split('#')[0], undefined, function(ok, body){
                    if (!ok) {
                        console.log("Cant refresh matrix" + body);
                    } else {
                        matrix.refresh();
                        refreshButton.disabled = false;
                    };
                });
            }, false);
            
            clearElement(naviCenter);
            naviCenter.appendChild(refreshButton);
        };

        // @@ Give other combos too-- see schedule ontology
        var possibleAvailabilities = [ SCHED('No'), SCHED('Maybe'), SCHED('Yes')];
 
        var me_uri = tabulator.preferences.get('me');
        var me = me_uri? kb.sym(me_uri) : null;
        
        var dataPointForNT = [];
        
        if (me) {
            var doc = resultsDoc;
            options.set_y = options.set_y.filter(function(z){ return (! z.sameTerm(me))});
            options.set_y.push(me); // Put me on the end

            options.cellFunction = function(cell, x, y, value) {
            
                var refreshColor = function() {
                    var bg = kb.any(value, UI('backgroundColor'));
                    if (bg) cell.setAttribute('style', 'text-align: center; background-color: ' + bg + ';');                    
                };
                if (value !== null) {
                    kb.fetcher.nowOrWhenFetched(value.uri.split('#')[0], undefined, function(uri, ok, error){
                        refreshColor();
                    });
                } 
                if (y.sameTerm(me)) {
                    var callback = function() { refreshColor(); }; //  @@ may need that
                    var selectOptions = {};
                    var predicate = SCHED('availabilty');
                    var cellSubject = dataPointForNT[x.toNT()];
                    var selector = tabulator.panes.utils.makeSelectForOptions(dom, kb, cellSubject, predicate,
                            possibleAvailabilities, selectOptions, resultsDoc, callback);
                    cell.appendChild(selector);
                } else if (value !== null) {
                    
                    cell.textContent = tabulator.Util.label(value);
                }
            
            };

            var responses = kb.each(invitation, SCHED('response'));
            var myResponse = null;
            responses.map(function(r){
                if (kb.holds(r, DC('author'), me)) {
                    myResponse = r;
                }
            });

            var insertables = [];  // list of statements to be stored
            
            var id = tabulator.panes.utils.newThing(doc).uri
            if (myResponse === null) {
                myResponse = $rdf.sym(id + '_response' );
                insertables.push($rdf.st(invitation, SCHED('response'), myResponse, doc));
                insertables.push($rdf.st(myResponse, DC('author'), me, doc));
            } else {
                var dps = kb.each(myResponse, SCHED('cell'));
                dps.map(function(dataPoint){
                    var time = kb.any(dataPoint, ICAL('dtstart'));
                    dataPointForNT[time.toNT()] = dataPoint;
                });
            }
            for (var j=0; j < possibleTimes.length; j++) {
                if (dataPointForNT[possibleTimes[j].toNT()]) continue;
                var dataPoint = $rdf.sym(id + '_' + j);
                insertables.push($rdf.st(myResponse, SCHED('cell'), dataPoint, doc));
                insertables.push($rdf.st(dataPoint, ICAL('dtstart'), possibleTimes[j], doc)); // @@
                dataPointForNT[possibleTimes[j].toNT()] = dataPoint;
            }
            if (insertables.length) {
                tabulator.sparql.update([], insertables, function(uri,success,error_body){
                    if (!success) {
                        complainIfBad(success, error_body);
                    } else {
                        displayTheMatrix();
                    }
                });
                
            } else { // no insertables
                displayTheMatrix();
            };
            
        } else {
            // pass me not defined
        }
        
        
        var editButton = dom.createElement('button');
        editButton.textContent = "(Edit poll)";
        editButton.addEventListener('click', function(e) {
            clearElement(div);
            showForms();
        }, false);
        
        clearElement(naviLeft);
        naviLeft.appendChild(editButton);
        
        // div.appendChild(editButton);
  
        
        
        clearElement(naviRight);
        naviRight.appendChild(newInstanceButton());
    
    }; // showResults
    
    var structure = div.appendChild(dom.createElement('table')); // @@ make responsive style
    structure.setAttribute('style', 'background-color: white; min-width: 40em; min-height: 13em;');
    
    var naviLoginoutTR = structure.appendChild(dom.createElement('tr'));
    var naviLoginout1 = naviLoginoutTR.appendChild(dom.createElement('td'));
    var naviLoginout2 = naviLoginoutTR.appendChild(dom.createElement('td'));
    var naviLoginout3 = naviLoginoutTR.appendChild(dom.createElement('td'));
    
    var logInOutButton = tabulator.panes.utils.loginStatusBox(dom, setUser);
    // floating divs lead to a mess
    // logInOutButton.setAttribute('style', 'float: right'); // float the beginning of the end
    naviLoginout3.appendChild(logInOutButton);
    logInOutButton.setAttribute('style', 'margin-right: 0em;')


    var naviTop = structure.appendChild(dom.createElement('tr'));
    var naviMain = naviTop.appendChild(dom.createElement('td'));
    naviMain.setAttribute('colspan', '3');

    var naviMenu = structure.appendChild(dom.createElement('tr'));
    naviMenu.setAttribute('class', 'naviMenu');
//    naviMenu.setAttribute('style', 'margin-top: 3em;');
    var naviLeft = naviMenu.appendChild(dom.createElement('td'));
    var naviCenter = naviMenu.appendChild(dom.createElement('td'));
    var naviRight = naviMenu.appendChild(dom.createElement('td'));

    getForms();

});


