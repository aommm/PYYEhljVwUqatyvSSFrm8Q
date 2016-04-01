Currency Exchange Rate Worker
-----------------------------
A script which gets currency exchange rates from https://fixer.io and puts them into a mongodb database.

Consists of a worker which continually gets conversion jobs from a beanstalkd queue.
A job is considered finished if it succeeds 10 times. If a job fails 3 times in total, the job is discarded.

### Howto run

1. Update `config.js` with connection strings for mongodb and beanstalk queue
2. Launch worker(s): `node index.js`
3. Give the worker(s) tasks by putting jobs into the pipeline, i.e. by using `node scripts/put.js`.
  1. Jobs are on the following format: `{from: 'HKD', to: 'USD'}`
4. Find results in mongodb
  1. Results are on the following format: `{from: 'HKD', to: 'USD', timestamp: new Date(...), rate: '0.13'}`

### Howto run tests
1. Update `config.js` with connection strings for mongodb test database and beanstalk queue
2. `npm test`


### Known issues
* Tests:
  * Sometimes, test queue can hold old test jobs, which can cause tests to fail.
    * _Workaround_: Run `node scripts/clear.js aommm-test` to clear queue
    * _Planned fix_: Tell Mocha to empty test queue before running tests
  * "Launching workers" test lets worker run for 20 seconds before checking mongodb.
    Obviously the workers could take longer than that, so tests might fail.
    * _Planned fix_: Change the way workers are launched, so that they report on success to somewhere.
      Launch workers until no job has been found for x seconds, then declare a failure.

### Further work
* Use another data source. Fixer.io is only updated once a day, so techically it is unnecessary to do a job 10 times since it will always yield the same result.
* Refactoring:
  * Use co/bluebird in tests/index.js
  * Use co/bluebird in producer.js
  * Create and export `Worker` class instead of functions from `worker.js` (cleaner interface)
  * Supply `Worker` class with config in constructor, so as to not mutate config from tests (bad practise)
* Tests:
  * Refactor enabling/disabling of console log by using a `logger` function in `worker.js`


