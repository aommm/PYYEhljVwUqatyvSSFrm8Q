var co = require('co');
var Promise = require("bluebird");
var mongo = require("mongoskin");

var config = require('./config');
var utils = require('./utils');

Promise.promisifyAll(mongo);

function onError(err) {
  console.log('Unrecoverable error:', err);
}
function runMain() {
  main().catch(onError);
}

/**
 * Launches a new worker.
 * Worker gets a job from queue, processes it, reschedules/buries it, and starts over
 * @returns {Promise}
 */
function main() {
  return co(function*() {
    const result = yield getJob();
    const client = result.client;
    const job = result.job;
    runMain(); // immediately start listening for new job
    console.log(job.id,"got job! processing...",job);
    try {
      var exchangeRate = yield getExchangeRate(job);
    } catch (err) {}
    if (exchangeRate)
      yield updateMongoDb(job, exchangeRate);
    yield maybeRescheduleJob(client, job, exchangeRate);
    console.log(job.id,'job done');
    client.disconnect();
  });
}

/**
 * Gets a job from beanstalk queue and parses into a usable format
 * @returns {Promise} - returns e.g. {client: ..., job: ...}
 */
function getJob() {
  return co(function*() {
    // Open new socket and connect to a tube
    var client = utils.newBeanstalkClient();
    yield client.watchAsync(config.bsTube);
    // Get job
    console.log('waiting for job...');
    var job = yield client.reserveAsync();
    // Handle input
    job.data = JSON.parse(job.data);
    if (typeof job.data.failed == 'undefined')
      job.data.failed = 0;
    if (typeof job.data.succeeded == 'undefined')
      job.data.succeeded = 0;
    return {client: client, job: job};
  });
}

/**
 * Takes a job and its result, and puts the result into mongodb
 * @param {Object} job
 * @param {Object} success
 * @returns {Promise}
 */
function updateMongoDb(job, exchangeRate) {
  return co(function*() {
    console.log("updateMongoDb", arguments);
  });
}

/**
 * Takes a job and buries/reschedules it in beanstalk queue
 * @param {Object} client
 * @param {Object} job
 * @param {Object} success
 * @returns {Promise}
 */
function maybeRescheduleJob(client, job, success) {
  return co(function*() {
    console.log("maybeRescheduleJob", arguments);
    if (success) {
      job.data.succeeded++;
    } else {
      job.data.failed++;
    }
    // Failed too much? bury job
    if (job.data.failed >= 3) {
      console.log(job.id,'bury');
      yield client.buryAsync(job.id);
    }
    // Succeeded enough times? Delete it
    else if (job.data.succeeded >= 10) {
      console.log(job.id,'delete');
      yield client.deleteJobAsync(job.id);
    }
    else { // Else, put job back into queue
      console.log(job.id,'put back into queue');
      var delay = success ? 60 : 3;
      // Delete job, then put back into queue with new body
      yield client.deleteJobAsync(job.id);
      var data = JSON.stringify(job.data);
      yield client.putAsync(data, undefined, delay);
    }
  });
}

function getExchangeRate(client, job) {
  return new Promise(function(resolve, reject) {
    // doing something really expensive
    setTimeout(function() {
      //resolve(true);
      reject("asdf!");
    }, 1000);
  });
}

runMain();