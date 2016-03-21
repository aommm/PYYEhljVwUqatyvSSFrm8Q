var bs = require('nodestalker');
var config = require('../config');

var client = bs.Client(config.bsConfig);
console.log('putting something...');

client.use(config.bsTube).onSuccess(function() {
  console.log("use done", arguments);
  client.put('dodido', undefined, 0)
  .onSuccess(function () {
    console.log('...all done!', arguments);
    client.disconnect();
  });
});
