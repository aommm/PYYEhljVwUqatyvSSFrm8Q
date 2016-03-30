'use strict';
const config = require('./config');
const bs = require('nodestalker');
const Promise = require('bluebird');

/**
 * Promisifies a NodeStalker method
 */
function nodeStalkerPromisifier(method) {
	return function promisified() {
		const args = [].slice.call(arguments);
		const self = this;
		return new Promise(function (resolve, reject) {
			method.apply(self, args).onSuccess(resolve).onError(reject);
		});
	};
}

/**
 * Creates a new, promisified beanstalk client
 * E.g. in addition to "reserve" method, this has "reserveAsync" also
 *
 * @returns {BeanstalkClient}
 */
function newBeanstalkClient() {
	let client = bs.Client(config.bs_config);
	// (Must promisify each instance here afaik, since we don't have access to class)
	client = Promise.promisifyAll(client, {promisifier: nodeStalkerPromisifier});
	return client;
}

/**
 * Checks if HTTP status code is 4xx or 5xx
 * @param {String|Number} code
 * @returns {boolean} - true if status code is bad, false if good
 */
function badStatusCode(code) {
	code = String(code);
	return ['4', '5'].indexOf(code[0]) !== -1;
}

//setTimeout that returns a promise
function delay(ms) {
	var deferred = Promise.pending();
	setTimeout(function(){
		deferred.resolve();
	}, ms);
	return deferred.promise;
}

module.exports = {
	newBeanstalkClient: newBeanstalkClient,
	badStatusCode: badStatusCode,
	delay: delay
};
