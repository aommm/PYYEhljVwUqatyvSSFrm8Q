var co = require('co');
var Promise = require("bluebird");

var config = require('./config');
var utils = require('./utils');

function processJob(job) {
  return new Promise(function(resolve, reject) {
    // doing something really expensive
    console.log('processing...');
    setTimeout(function() {
      resolve();
    }, 1000);
  });
}

function onError(err) {
  console.log('Unrecoverable error:', err);
}

// Wait for a job from beanstalk queue.
// When job arrives, run it and go back to listening for new job recursively
var getJob = co.wrap(function* () {
  // Open new socket and connect to a tube
  var client = utils.newBeanstalkClient();
  yield client.watchAsync(config.bsTube);
  console.log('waiting for job...');
  var job = yield client.reserveAsync();
  getJob().catch(onError); // immediately start listening for new job
  runJob(client, job).catch(onError);
});

// Run a given job
var runJob = co.wrap(function* (client, job) {
  console.log(job.id,"got job! processing...",job);
  yield processJob(job);
  console.log(job.id,"deleting...");
  yield client.deleteJobAsync(job.id);
  console.log(job.id,'job done');
  client.disconnect();
});

// Run everything
getJob().catch(onError);
