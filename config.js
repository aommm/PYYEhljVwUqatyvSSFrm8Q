'use strict';
module.exports = {
	bs_config: {
		address: 'challenge.aft' + 'ership.net', // obfuscate company name
		port: 11300
	},
	bs_tube: 'aommm',
	mongo_address: 'localhost/PYYEhljVwUqatyvSSFrm8Q',
	success_limit: 10, // number of times a job should succeed before being completed
	success_delay: 60, // (seconds) how long to wait after a successful job
	fail_limit: 3, // number of times a job should fail before being buried
	fail_delay: 3 // (seconds) how long to wait after a failed job
};
