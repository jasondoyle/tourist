#!/usr/bin/env node
// Copyright (c) 2013 Tom Steele
// See the file license.txt for copying permission

var fs = require('fs');
var async = require('async');
var webshot = require('webshot');
var Progress = require('progress');
var request = require('request');
var color = require('colors');

var argv = require('optimist')
  .demand(1)
  .describe('c', 'Amount of concurrent requests')
  .options('c', {
           alias: 'concurrency',
           default: 1000
           })
  .describe('u', 'User-Agent string')
  .options('u', {
           alias: 'useragent',
           default: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17'
  })
  .describe('h', 'Screenshot height')
  .options('h', {
           alias: 'height',
           default: 400
  })
  .describe('w', 'Screenshot width')
  .options('w', {
           alias: 'width',
           default: 400
  })
  .describe('p', 'phantomjs path')
  .options('p', {
           alias: 'phantom',
           default: 'phantomjs'
  })
  .describe('t', 'Timeout in milliseconds')
  .options('t', {
           alias: 'timeout',
           default: 10000
  })
  .describe('j', 'Output JSON object')
  .alias('j', 'json')
  .describe('o', 'Output file')
  .options('o', {
    alias: 'out',
    default: 'index.html'
  })
  .describe('a', 'Append to file')
  .alias('a', 'append')
  .check(checkArgs)
  .usage("$0 [options] <url file>").argv;

// really should never do this, but there is some wonkyness in the webshot callback with errors.
// it can callback with an error, and then still emit events.
process.on('uncaughtException', function(err) {});

// phantomjs webshot options
var options = {
  screenSize: {
    width: argv.w,
    height: argv.h,
  },
  phantomConfig: {
    'ignore-ssl-errors': 'true'
  }, 
  userAgent: argv.u,
  phantomPath: argv.p,
  timeout: argv.t
};

// read file in and create list of urls
var urls = fs.readFileSync(argv._[0], {encoding: 'utf8'}).trim().split("\n");
var results = [];

// async queue
var q = async.queue(getScreenShot, argv.c);
q.push(urls);
q.drain = complete;

// progress bar
var bar = new Progress('requests [:bar] :percent :etas'.green, { complete: '=', width: 20, total: urls.length });
function getScreenShot(url, cb) {
  var img = '';
  // request the page once first to get around phantomjs 401 bug
  var ropts = {'url': url, 'strictSSL': false, headers:{'User-Agent': argv.u}};
  request(ropts, function(err, res) {
    // if response was not 401 grab a screenshot
    if (!err && res.statusCode !== 401) {
      var href = res.request['uri'].href;
      webshot(href, options, function(err, rs) {
        if (err) {
          bar.tick();
          cb();
        }
        else {
          rs.on('data', function(data) {
            var string = data.toString('base64');
            if (!string.match(/Error/)) {
              img += data.toString('base64');
            }
          });
          rs.on('error', function(err) {
            bar.tick();
            cb();
          });
          rs.on('end', function() {
            bar.tick();
            results.push({"url": url, "href": href, "img": img});
            cb();
          });
        }
      });
    }
    // else if error or a 401 just skip it
    else {
      bar.tick();
      cb();
    }
  });
 }

// append or write to file
function complete() {
  console.log('\n');
  if (argv.a) {
    console.log('appending to file', argv.a);
  }
  else {
    console.log('saving results to file', argv.o);
  }

  if (argv.j) {
    jsonOut(results);
  }
  else {
    htmlOut(results);
  }
  process.exit(0);
}

// output the results object as json
function jsonOut(results) {
  var string = JSON.stringify(results, null, " ");
  if (argv.o) {
    fs.writeFileSync(argv.o, string);
  }
  else if (argv.a) {
    fs.appendFileSync(argv.a, string);
    process.exit(0);
  }
  else {
    console.log(string);
  }
}

// create a html file with the results
function htmlOut(results) {
  // gentle css for styling
  var css = ".outline {border: 1px solid black;} html,body {padding: 10px;}"

  if (!argv.a) {
    var string = '<html lang="en"><head><style>' + css + '</style></head><body>'
  }

  results.forEach(function(r) {
    string += '<p><a href="' + r.url + '">' + r.url + "</a></p>";
    if (r.href) { string += '<p>=> <a href="' + r.href + '">' + r.href + "</a></p>"; }
    string += '<img class="outline" src="data:image/png;base64,' + r.img + '"/><br />';
  });

  if (!argv.a) {
    string += '</body></html>';
  }
  if (argv.a) {
    fs.appendFileSync(argv.a, string);
  }
  else {
    fs.writeFileSync(argv.o, string);
  }
}

// check argv arguments for errors
function checkArgs(argv) {
  if (!fs.existsSync(argv._[0])) {
    throw 'url file does not exist'.red;
  }
  if (isNaN(argv.c) || argv.c < 0) {
    throw 'invalid concurrency amount given'.red;
  }
  if (argv.a && !fs.existsSync(argv.a)) {
    throw 'append file does not exist'.red;
  }
}
