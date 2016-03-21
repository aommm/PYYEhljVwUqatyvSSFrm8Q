var bs = require('nodestalker');
var config = require('./config');


function processJob(job, callback) {
  // doing something really expensive
  console.log('processing...');
  setTimeout(function() {
    callback();
  }, 1000);
}

function resJob() {
  var client = bs.Client(config.bsConfig);

  client.watch(config.bsTube).onSuccess(function(data) {
    client.reserve().onSuccess(function(job) {
      console.log('received job:', job);
      resJob(); // start listening again immediately

      processJob(job, function() {
        // TODO: check how it went
        client.deleteJob(job.id).onSuccess(function(del_msg) {
          console.log('deleted', job);
          console.log(del_msg);
          client.disconnect();
        });
        console.log('processed', job);
      });
    });
  });
}

resJob();