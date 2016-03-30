'use strict';
const bs = require('nodestalker');
const config = require('./config');


function addToQueue(from, to) {
	const client = bs.Client(config.bs_config);
	console.log('putting something...');

	client.use(config.bs_tube).onSuccess(function () {
		console.log('use done', arguments);
		const obj = {from: from, to: to};
		client.put(JSON.stringify(obj), undefined, 0)
			.onSuccess(function () {
				console.log('...all done!', arguments);
				client.disconnect();
			});
	});
}

module.exports = {
	addToQueue: addToQueue
}