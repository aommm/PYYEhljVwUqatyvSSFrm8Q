'use strict';
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const Promise = require('bluebird');


const index = require('../index');

chai.use(chaiAsPromised);


describe('Exchange rates', function () {
	it('gets exchange rate correctly', function () {
		const promise = index.getExchangeRate({data: {from: 'HKD', to: 'USD'}});
		return Promise.all([
			expect(promise).to.eventually.be.a('string')
			// expect(promise.length).to.eventually.be.between(2,4)
		]);
	});
});
