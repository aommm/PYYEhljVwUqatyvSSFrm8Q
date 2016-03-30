'use strict';
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const Promise = require('bluebird');
const _ = require('lodash');
const uuid = require('uuid');
const monk = require('monk');

const worker = require('../worker');
const producer = require('../producer');
const config = require('../config');

chai.use(chaiAsPromised);

// ----------------------------------------------------------------------------
// Utilities for disabling/enabling console.log while running tests

let old_console_log;
function disableConsoleLog() {
	if (!old_console_log) {
		old_console_log = console.log;
		console.log = _.noop;
	}
}
function enableConsoleLog() {
	console.log = old_console_log;
	old_console_log = null;
}

// ----------------------------------------------------------------------------
// Tests

describe('Exchange rates', function () {
	this.timeout(5000);
	it('gets exchange rate correctly', function () {
		const promise = worker._getExchangeRate({data: {from: 'HKD', to: 'USD'}});
		return Promise.all([
			expect(promise).to.eventually.be.a('string')
			// expect(promise.length).to.eventually.be.between(2,4)
		]);
	});
});

describe('Beanstalk queue', function () {
	this.timeout(5000);

	let old_config;
	before(function () {
		disableConsoleLog();
		// Temporarily change config
		old_config = _.cloneDeep(config);
		config.bs_tube = 'aommm-test';
		config.fail_delay = 0;
		config.success_delay = 0;
		config.mongo_address = 'localhost/' + uuid.v4(); // Use random db

		return Promise.all([
			worker._initDb(), // Tell worker to use the random db
			producer.addToQueue('HKD', 'USD') // Put a job into pipeline
		]);
	});

	after(function () {
		// Delete mongodb
		const db = monk(config.mongo_address);
		const exchangeRates = db.get('exchangeRates');
		const dropPromise = Promise.resolve(exchangeRates.drop()).catch(_.noop); // If drop failed, don't tell mocha
		// Restore config
		_.assign(config, old_config);
		return dropPromise;
	});

	// Disable console.log before each test
	// (Enabling needs to take place manually in each test in order for mocha output to get logged; see tests below)
	beforeEach(disableConsoleLog);

	it('gets a job from queue', function () {
		return worker._getJob().then(enableConsoleLog);
	});

});

