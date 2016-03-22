var config = require('./config');
var bs = require('nodestalker');
var Promise = require("bluebird");

/**
 * Promisifies a NodeStalker method
 */
function nodeStalkerPromisifier(method) {
  return function promisified() {
    var args = [].slice.call(arguments);
    var self = this;
    return new Promise( function(resolve, reject) {
      method.apply(self, args).onSuccess(resolve).onError(reject);
    });
  }
}

/**
 * Creates a new, promisified beanstalk client
 * E.g. in addition to "reserve" method, this has "reserveAsync" also
 *
 * @returns {BeanstalkClient}
 */
function newBeanstalkClient() {
  var client = bs.Client(config.bsConfig);
  // (Must promisify each instance here afaik, since we don't have access to class)
  client = Promise.promisifyAll(client, {promisifier: nodeStalkerPromisifier});
  return client;
}

module.exports = {
  newBeanstalkClient: newBeanstalkClient
};