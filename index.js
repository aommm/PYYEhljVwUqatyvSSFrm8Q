const co = require('co');
const Promise = require('bluebird');
var   request = require('request');

const config = require('./config');
const utils = require('./utils');

request = Promise.promisify(request, {multiArgs: true});
var db = require('monk')(config.mongoAddress);
var exchangeRates = db.get('exchangeRates');

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
      yield addToMongo(job, exchangeRate);
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
 * @param {String} exchangeRate
 * @returns {Promise}
 */
function addToMongo(job, exchangeRate) {
  return co(function*() {
    const doc = {
      from: job.data.from,
      to: job.data.to,
      created_at: new Date(),
      rate: exchangeRate
    };
    const res = yield exchangeRates.insert(doc);
    console.log(job.id,'added to mongo:', res);
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
      // Cannot modify job payloads (afaik); therefore, delete job and put back into queue with new payload
      yield client.deleteJobAsync(job.id);
      var data = JSON.stringify(job.data);
      yield client.putAsync(data, undefined, delay);
    }
  });
}

/**
 * Gets exchange rate from fixer.io
 *
 * @param {String} job.data.from - e.g. 'HKD'
 * @param {String} job.data.to - e.g. 'USD'
 * @returns {Promise} - @returns {String} rounded to two decimal places, i.e. "0.13"
 */
function getExchangeRate(job) {
  return co(function*() {
    // Get exchange rate from fixer.io
    const url = "https://api.fixer.io/latest?base="+job.data.from+"&symbols="+job.data.to;
    const result = yield request({method: 'GET', url: url, json: true});
    const response = result[0];
    const body = result[1];
    if (utils.badStatusCode(response.statusCode))
      throw new Error("Bad API request:"+response.statusCode+body);
    // Extract exchange rate from response body
    const exchangeRate = body.rates[job.data.to].toFixed(2);
    return exchangeRate;
  });
}

runMain();