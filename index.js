var co = require('co');
var Promise = require("bluebird");

var config = require('./config');
var utils = require('./utils');

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
  job.data = JSON.parse(job.data);
  if (typeof job.data.failed == 'undefined')
    job.data.failed = 0;

  console.log(job.id,"got job! processing...",job);
  var success = yield processJob(job);
  // TODO: can maybe inspect promise object instead of success?

  //yield client.deleteJob(job.id);
  //return;

  if (success) {
    // Success! Add to mongodb
  }
  else {
    job.data.failed++;
  }

  // Failed too much? bury job
  if (job.data.failed >= 3) {
    console.log(job.id,'bury');
    yield client.buryAsync(job.id);
  }
  // Else, put job back into queue
  else {
    console.log(job.id,'put back into queue');
    var delay = success ? 60 : 3;
    // Delete job, then put back into queue with new body
    yield client.deleteJobAsync(job.id);
    var data = JSON.stringify(job.data);
    yield client.putAsync(data, undefined, delay);
  }
  console.log(job.id,'job done');
  client.disconnect();
});

function processJob(client, job) {
  return new Promise(function(resolve, reject) {
    // doing something really expensive
    setTimeout(function() {
      resolve(true);
    }, 1000);
  });
}

// Run everything
getJob().catch(onError);
