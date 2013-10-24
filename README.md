Tourist
======

Take screenshots of sites. Uses <a href="https://github.com/brenden/node-webshot">node-webshot</a>, which in turn uses <a href="http://phantomjs.org/">phantomjs</a>.

Images are saved as base64 strings of pngs.

###Installation###
After installing phantomjs to $PATH:

        $ git clone https://github.com/tomsteele/tourist.git
        $ npm -g install tourist
        $ tourist -h


###Usage###
Tourist takes multiple options and a single argument for a file containing newline separated urls.

        tourist [options] <url file>

        Options:
             -u, --useragent    User-Agent string              [default: "Mozilla/5.0..]
             -h, --height       Screenshot height              [default: 400]
             -w, --width        Screenshot width               [default: 400]
             -p, --phantom      phantomjs path                 [default: "phantomjs"]
             -j, --json         Output JSON object
             -o, --out          Output file                    [default: "index.html"]
             -a, --append       Append to file
