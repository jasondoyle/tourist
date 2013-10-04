#!/usr/bin/env node
// Copyright (c) 2013 Tom Steele
// See the file license.txt for copying permission

var fs = require('fs');
var async = require('async');
var webshot = require('webshot');
var request = require('request');
var color = require('colors');
var winston = require('winston');

var argv = require('optimist')
  .demand(1)
  .describe('c', 'Amount of concurrent requests')
  .options('c', {
           alias: 'concurrency',
           default: 10
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
  .boolean('j')
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

process.on('uncaughtException', function(err) {
  winston.error('Uncaught Exception', err.message);
});

// phantomjs webshot options
var wopts = {
  screenSize: {
    width: argv.w,
    height: argv.h
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
var pace = require('pace')(urls.length);

async.eachLimit(urls, argv.c, makeRequest, complete);

function makeRequest(url, cb) {
  // request the page once first to get around phantomjs 401 bug
  var opts = {'url': url, 'strictSSL': false, headers:{'User-Agent': argv.u}, timeout: argv.t};
  href = '';
  request(opts, handleResponse);

  function handleResponse(err, res) {
    if (!err && res.statusCode !== 401) {
      href = res.request.uri.href;
      webshot(href, wopts, handleWebshot);
    } else {
      pace.op();
      cb();
    }
  }

  function handleWebshot(err, rs) {
    var img = '';
    var cbCalled = false;
    if (err) {
      handleError();
    } else {
      rs.on('error', handleError);
      rs.on('data', function(data) {
        var string = data.toString('base64');
        if (!string.match(/Error/)) {
          img += data.toString('base64');
        }
      });
      rs.on('end', function() {
        process.nextTick(pushResult);
      });
    }

    function handleError() {
      if (!cbCalled) {
        cbCalled = true;
        pace.op();
        cb();
      }
    }

    function pushResult() {
      results.push({"url": url, "href": href, "img": img});
      if (!cbCalled) {
        cbCalled = true;
        pace.op();
        cb();
      }
    }
  }
 }

function complete(err) {
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

function jsonOut(results) {
  var string = JSON.stringify(results, null, " ");
  if (argv.o !== 'index.html') {
    fs.writeFileSync(argv.o, string);
  }
  else if (argv.a) {
    fs.appendFileSync(argv.a, string);
  }
  else {
    console.log(string);
  }
}

function htmlOut(results) {
  var css = '.outline {border: 1px solid black;} html,body {padding: 10px;}';
  var string = '';
  if (!argv.a) {
    string += '<html lang="en"><head><style>' + css + '</style></head><body>';
  }

  results.forEach(function(r) {
    string += '<p><a href="' + r.url + '">' + r.url + '</a></p>';
    if (r.href !== r.url) { 
       string += '<p>=> <a href="' + r.href + '">' + r.href + '</a></p>';
    }
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

function checkArgs(argv) {
  if (!fs.existsSync(argv._[0])) {
    throw 'url file does not exist'.red;
  }
  if (argv.a && !fs.existsSync(argv.a)) {
    throw 'append file does not exist'.red;
  }
}
