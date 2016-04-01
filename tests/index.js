'use strict';
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const chaiThings = require('chai-things');
const Promise = require('bluebird');
const _ = require('lodash');
const uuid = require('uuid');
const monk = require('monk');

const worker = require('../worker');
const producer = require('../producer');
const config = require('../config');
const utils = require('../utils');

chai.use(chaiAsPromised);
chai.use(chaiThings);

// ----------------------------------------------------------------------------
// Utilities


// Disable/enable console.log while running tests
let old_console_log;
function disableConsoleLog() {
	if (!old_console_log) {
		old_console_log = console.log;
		console.log = _.noop;
	}
}
function enableConsoleLog() {
	if (old_console_log) {
		console.log = old_console_log;
		old_console_log = null;
	}
}

let old_config;
function mockConfig() {
	disableConsoleLog();
	// Temporarily change config
	old_config = _.cloneDeep(config);
	config.bs_tube = 'aommm-test';
	config.fail_delay = 0;
	config.success_delay = 0;
	//config.mongo_address = 'localhost/' + uuid.v4(); // Use random db
	config.mongo_address = config.mongo_address_test;
	return worker._initDb(); // Tell worker to use the random db
}
function restoreConfig() {
	// Delete mongodb
	const db = monk(config.mongo_address);
	const exchangeRates = db.get('exchangeRates');
	const dropPromise = Promise.resolve(exchangeRates.drop()).catch(_.noop); // If drop failed, don't tell mocha
	//const dropPromise = db.driver.dropDatabase();
	// Restore config
	_.assign(config, old_config);
	return dropPromise;
}

// ----------------------------------------------------------------------------
// Tests

describe('Exchange rates', function () {
	this.timeout(5000);
	it('gets exchange rate correctly', function () {
		const promise = worker._getExchangeRate({data: {from: 'HKD', to: 'USD'}});
		return Promise.all([
			expect(promise).to.eventually.be.a('string'),
			expect(promise).to.eventually.be.property('length').within(1, 6)
		]);
	});
});

describe('Beanstalk queue', function () {
	this.timeout(5000);
	before(mockConfig);
	after(restoreConfig);
	before(function () {
		return producer.addToQueue('HKD', 'USD'); // Put a job into pipeline
	});
	// Disable console.log before each test
	// (Enabling needs to take place manually in each test in order for mocha output to get logged; see tests below)
	beforeEach(disableConsoleLog);

	it('Gets a job', function () {
		return worker._getJob()
			.then(function (result) {
				// Delete job
				const job = result.job;
				const client = result.client;
				return client.deleteJob(job.id);
			})
			.then(enableConsoleLog);
	});

});

describe('Launching workers', function () {
	this.timeout(20000);
	before(mockConfig);
	after(restoreConfig);
	before(function () {
		return producer.addToQueue('HKD', 'USD'); // Put a job into pipeline
	});
	// Disable console.log before each test
	// (Enabling needs to take place manually in each test in order for mocha output to get logged; see tests below)
	beforeEach(disableConsoleLog);

	it('Worker processes 10 jobs successfully and adds result to mongodb', function () {
		enableConsoleLog();

		const promise = worker.__launchWorker() // Launch a worker
			.then(function () {
				return utils.delay(15000); // Hope that it completes 10 jobs within 15seconds
			})
			.then(function () {
				// Get all jobs from mock mongo database
				const db = monk(config.mongo_address);
				const exchangeRates = db.get('exchangeRates');
				return exchangeRates.find();
			})
			.then(function (exchangeRates) {
				// Expect results to be {to: ..., from:..., rate:...}, and expect 10 results
				expect(exchangeRates.length).to.equal(10);
				expect(exchangeRates).to.all.satisfy(function (x) {
					expect(x.from).to.equal('HKD');
					expect(x.to).to.equal('USD');
					expect(x.rate.length).to.be.within(1, 6);
					return true;
				});
			})
			.then(enableConsoleLog);
		return promise;
	});

});

