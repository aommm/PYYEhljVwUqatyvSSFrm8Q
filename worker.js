'use strict';
const co = require('co');
const Promise = require('bluebird');
let request = require('request');

const config = require('./config');
const utils = require('./utils');

request = Promise.promisify(request, {multiArgs: true});
let exchangeRates;


/**
 * Launches a new worker.
 * Worker gets a job from queue, processes it, reschedules/buries it, and starts over
 */
function launchWorker() {
	_initDb();
	_launchWorker();
}

/**
 * Open the connection to the database
 * @private
 */
function _initDb() {
	console.log('initing db:', config.mongo_address);
	const db = require('monk')(config.mongo_address);
	exchangeRates = db.get('exchangeRates');
}

// Wrapper around __launchWorker which handles errors
function _launchWorker() {
	function onError(err) {
		console.log('Unrecoverable error:', err);
	}
	__launchWorker().catch(onError);
}

/**
 * @returns {Promise}
 * @private
 */
function __launchWorker() {
	return co(function*() {
		const result = yield _getJob();
		const client = result.client;
		const job = result.job;
		_launchWorker(); // immediately start listening for new job
		console.log(job.id, 'got job! processing...', job);
		let exchange_rate;
		try {
			exchange_rate = yield _getExchangeRate(job);
		} catch (err) {
			console.log(job.id, 'job failed');
		}
		if (exchange_rate) {
			yield _addToMongo(job, exchange_rate);
		}
		yield _maybeRescheduleJob(client, job, exchange_rate);
		console.log(job.id, 'job done');
		client.disconnect();
	});
}

/**
 * Gets a job from beanstalk queue and parses into a usable format
 * @returns {Promise} - returns e.g. {client: ..., job: ...}
 * @private
 */
function _getJob() {
	return co(function*() {
		// Open new socket and connect to a tube
		const client = utils.newBeanstalkClient();
		yield client.watchAsync(config.bs_tube);
		// Get job
		console.log('waiting for job...');
		const job = yield client.reserveAsync();
		// Handle input
		job.data = JSON.parse(job.data);
		if (typeof job.data.failed === 'undefined') {
			job.data.failed = 0;
		}
		if (typeof job.data.succeeded === 'undefined') {
			job.data.succeeded = 0;
		}
		return {client: client, job: job};
	});
}

/**
 * Takes a job and its result, and puts the result into mongodb
 * @param {Object} job
 * @param {String} exchangeRate
 * @returns {Promise}
 * @private
 */
function _addToMongo(job, exchangeRate) {
	return co(function*() {
		const doc = {
			from: job.data.from,
			to: job.data.to,
			created_at: new Date(),
			rate: exchangeRate
		};
		const res = yield exchangeRates.insert(doc);
		console.log(job.id, 'added to mongo:', res);
	});
}

/**
 * Takes a job and buries/reschedules it in beanstalk queue
 * @param {Object} client
 * @param {Object} job
 * @param {Object} success
 * @returns {Promise}
 * @private
 */
function _maybeRescheduleJob(client, job, success) {
	return co(function*() {
		if (success) {
			job.data.succeeded++;
		} else {
			job.data.failed++;
		}
		// Failed too much? bury job
		if (job.data.failed >= config.fail_limit) {
			console.log(job.id, 'bury');
			yield client.buryAsync(job.id);
		}
		// Succeeded enough times? Delete it
		else if (job.data.succeeded >= config.success_limit) {
			console.log(job.id, 'delete');
			yield client.deleteJobAsync(job.id);
		}
		else { // Else, put job back into queue
			console.log(job.id, 'put back into queue');
			const delay = success ? config.success_delay : config.fail_delay;
			// Cannot modify job payloads (afaik); therefore, delete job and put back into queue with new payload
			yield client.deleteJobAsync(job.id);
			const data = JSON.stringify(job.data);
			yield client.putAsync(data, undefined, delay);
		}
	});
}

/**
 * Gets exchange rate from fixer.io
 *
 * @param {Object} job
 * @param {Object} job.data
 * @param {String} job.data.from - e.g. 'HKD'
 * @param {String} job.data.to - e.g. 'USD'
 * @returns {Promise} - @returns {String} rounded to two decimal places, i.e. "0.13"
 * @private
 */
function _getExchangeRate(job) {
	return co(function*() {
		// Get exchange rate from fixer.io
		const url = 'https://api.fixer.io/latest?base=' + job.data.from + '&symbols=' + job.data.to;
		const result = yield request({method: 'GET', url: url, json: true});
		const response = result[0];
		const body = result[1];
		if (utils.badStatusCode(response.statusCode)) {
			throw new Error('Bad API request:' + response.statusCode + body);
		}
		// Extract exchange rate from response body
		const exchange_rate = body.rates[job.data.to].toFixed(2);
		return exchange_rate;
	});
}

module.exports = {
	launchWorker: launchWorker,
	_initDb: _initDb,
	_maybeRescheduleJob : _maybeRescheduleJob,
	_getExchangeRate: _getExchangeRate,
	_getJob: _getJob
};
