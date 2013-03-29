cetera
======

Take screenshots of sites. Uses <a href="https://github.com/brenden/node-webshot">node-webshot</a>, which in turn uses <a href="http://phantomjs.org/">phantomjs</a>.

Images are saved as base64 strings of pngs.

###Installation###
After installing phantomjs to $PATH:

        git clone https://github.com/tomsteele/cetera.git
        npm -g install cetera
        cetera -h


###Usage###
Cetera takes multiple options and a single argument for a file containing newline separated urls.     
        
        cetera [options] <url file>

        Options:
             -c, --concurrency  Amount of concurrent requests  [default: 1000]
             -u, --useragent    User-Agent string              [default: "Mozilla/5.0..]
             -h, --height       Screenshot height              [default: 400]
             -w, --width        Screenshot width               [default: 400]
             -p, --phantom      phantomjs path                 [default: "phantomjs"]
             -j, --json         Output JSON object           
             -o, --out          Output file                    [default: "index.html"]
             -a, --append       Append to file 
