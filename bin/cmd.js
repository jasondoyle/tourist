#!/usr/bin/env node
// Copyright (c) 2013 Tom Steele
// See the file license.txt for copying permission

var fs = require('fs');
var async = require('async');
var webshot = require('webshot');
var request = require('request');
var path = require('path');
var color = require('colors');
var winston = require('winston');
var checksum = require('checksum');
var argv = require('optimist')
  .demand(1)
  .describe('c', 'Amount of concurrent requests')
  .options('c', {
           alias: 'concurrency',
           default: 6
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

async.series([profile, screenshot], complete);

function profile(callback) {
  async.eachLimit(urls, argv.c, makeRequest, callback);

  function makeRequest(url, cb) {
    // sent first request to profile website and get app url for webshot
    var opts = {'url': url, 'strictSSL': false, headers:{'User-Agent': argv.u}, timeout: argv.t};

    request(opts, handleResponse);

    function handleResponse(err, res) {
      var loginRegex = new RegExp(/log(\s)?in|log(\s)?on|sign(\s)?in|sign(\s)?on/im);
      var interestRegex = [loginRegex,
                           new RegExp(/<(\s)?form/gim),
                           new RegExp(/<(\s)?input/gim),
                           new RegExp(/href(\s)?=/gim),
                           new RegExp(/window\.location/gim)];

      if (!err && res.statusCode !== 401) {
        var website = {};
        website.url = url;
        website.href = res.request.uri.href;
        website.interest = 0;
        website.login = false;
        website.hostname = res.request.uri.hostname;
        if (res.body.match(loginRegex)) {
          website.login = true;
        }
        interestRegex.forEach(function(p) {
          if (res.body.match(p)) {
            website.interest += (res.body.match(p)).length;
          }
        });
        results.push(website);
      }
      else {
        // output url if error
      }
      pace.op();
      cb();
    }
  } 
}

function screenshot(callback) {
  //reset pacer
  pace.total = results.length;
  pace.current = 0;

  async.eachLimit(results, argv.c, doWebshot, callback);

  function doWebshot(r, cb) {
    webshot(r.href, wopts, function(err, rs) {
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
          r.img = img;
          r.checksum = checksum(img);
          pace.op();
          cb();
        });
      }

      function handleError() {
        if (!cbCalled) {
          cbCalled = true;
          pace.op();
          cb();
        }
      }
    });
  }
}

function complete() {
  if (argv.a) {
    console.log('appending to file', argv.a);
  } else {
    console.log('saving results to file', argv.o);
  }

  if (argv.j) {
    jsonOut(results);
  } else {
    htmlOut(results);
  }
  process.exit(0);
}

function jsonOut(results) {
  var jsonData = JSON.stringify(results, null, " ");
  if (argv.o !== 'index.html') {
    fs.writeFileSync(argv.o, jsonData);
  } else if (argv.a) {
    fs.appendFileSync(argv.a, jsonData);
  } else {
    console.log(jsonData);
  }
}

function htmlOut(results) {
  var css = '.outline {border: 1px solid black;} html,body {padding: 10px;}';
  var htmlData = '';
  var jsTemplate = path.join(path.dirname(require.main.filename), '../lib/client.js');
  var js = fs.readFileSync(jsTemplate, { encoding: 'utf8' });

  if (!argv.a) {
    htmlData += '<html lang="en"><head><style>' + css + '</style>';
    htmlData += '<script type="text/javascript">' + js + '</script></head><body><form id="sortApp"><u>Sort Apps:</u><br>';
    htmlData += '<input type="radio" name="sort" value="interest" onclick="doSort(this.value);">Interest<br>';
    htmlData += '<input type="radio" name="sort" value="hostname" onclick="doSort(this.value);">Hostname<br>';
    htmlData += '<input type="radio" name="sort" value="login" onclick="doSort(this.value);">Login form<br><br>';
    htmlData += '<input type="checkbox" name="dups" onclick="hideDups(this.checked);">Hide Duplicate Apps</form>';
    htmlData += '<div id="container">';
  }
  results.forEach(function(r) {
    htmlData += '<span interest="' + r.interest + '" checksum="' + r.checksum + '" ';
    htmlData += 'login="' + r.login + '" hostname="' + r.hostname + '"><p>';
    htmlData += '<a href="' + r.url + '">' + r.url + '</a>';
    if (r.href !== r.url) {
      htmlData += ' => <a href="' + r.href + '">' + r.href + '</a></p>';
    } else {
      htmlData += '</p>';
    }
    htmlData += '<img class="outline" src="data:image/png;base64,' + r.img + '"/></span>';
  });
  if (argv.a) {
    fs.appendFileSync(argv.a, htmlData);
  } else {
    htmlData += '</div></body></html>';
    fs.writeFileSync(argv.o, htmlData);
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
