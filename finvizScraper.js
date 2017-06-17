const request = require('request');
const cheerio = require('cheerio');

function scraper(url){
  return new Promise((resolve,reject)=>{
    request.get({url, headers: {'User-Agent': 'Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405'}}, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error||'Error getting data');
      }else{
        resolve(cheerio.load(body));
      }
    });
  });
}

function recomended(){
  return scraper('http://finviz.com/screener.ashx?v=210&s=ta_p_channelup').then(($)=>{
    return $('img[class="charts-gal"]').map(function(){
      return $(this).attr('src');
    }).get().map(src=>`http://finviz.com/${src}`);
  });
}

module.exports = {
  recomended,
};
