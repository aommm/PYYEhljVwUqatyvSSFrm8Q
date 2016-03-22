var bs = require('nodestalker');
var config = require('../config');

var client = bs.Client(config.bsConfig);
console.log('putting something...');

client.use(config.bsTube).onSuccess(function() {
  console.log("use done", arguments);
  var obj = {from: 'HKD', to: 'USD'};
  client.put(JSON.stringify(obj), undefined, 0)
  .onSuccess(function () {
    console.log('...all done!', arguments);
    client.disconnect();
  });
});
