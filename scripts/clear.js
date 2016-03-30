'use strict';

// Deletes all jobs from a tube
// Usage: node clear.js myTubeName

const co = require('co');

const config = require('../config');
const worker = require('../worker');


function clear(tube_name) {
	return co(function*() {
		config.bs_tube = tube_name;
		const result = yield worker._getJob();
		const client = result.client;
		const job = result.job;
		console.log('deleting...', job.id);
		client.deleteJob(job.id);
		console.log('deleted');
		clear(tube_name);
	});
}

clear(process.argv[2]);
