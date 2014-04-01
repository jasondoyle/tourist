function doSort(attr) {
    var sorted = [];
    var spanEls = document.getElementsByTagName("span");
    var attrVals = getUniqueAttributes(attr, spanEls);
    if (attr === "interest") {
        attrVals.sort(function(a, b) {
            return b - a;
        });
    } else {
        attrVals.sort();
        if (attr === "login") {
            attrVals.reverse();
        }
    }
    attrVals.forEach(function(val) {
        for (var i = 0; i < spanEls.length; i++) {
            if (val === spanEls[i].getAttribute(attr)) {
                sorted.push(spanEls[i]);
            }
        }
    });
    writeHtml(sorted);
}

function hideDups(checked) {
    var spanEls = document.getElementsByTagName("span");
    var attrVals = getUniqueAttributes("checksum", spanEls);
    var unique = [];
    var imageErrors = ["undefined","null"];
    if (checked) {
        attrVals.forEach(function(val) {
            for (var i = 0; i < spanEls.length; i++) {
                var elVal = spanEls[i].getAttribute("checksum");
                if (val == elVal) {
                    if (unique.indexOf(elVal) > -1 && imageErrors.indexOf(elVal) === -1) {		
                        spanEls[i].style.display = "none"; // never hide erroneous dups
                    } else {
                        unique.push(elVal);
                    }
                }
            }
        });
    } else {
        for (var i = 0; i < spanEls.length; i++) {
            spanEls[i].style.display = "";
        }
    }
}

function getUniqueAttributes(attr, spanEls) {
    var vals = [];
    for (var i = 0; i < spanEls.length; i++) {
        vals.push(spanEls[i].getAttribute(attr));
    }

    function onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }
    return vals.filter(onlyUnique);
}

function writeHtml(spanEls) {
    var parent = document.getElementById("container");
    parent.innerHtml = "";
    spanEls.forEach(function(span) {
        parent.appendChild(span);
    });
}
