
Known issues
------------
* Tests:
  * Sometimes, test queue can hold old test jobs, which can cause tests to fail.
    * _Workaround_: Run `node scripts/clear.js aommm-test` to clear queue
    * _Fix_: Tell Mocha to empty test queue before running tests
  * "Launching workers" test lets worker run for 20 seconds before checking mongodb.
    Obviously the workers could take longer than that, so tests might fail.
    * _Fix_: Change the way workers are launched, so that they report on success to somewhere.
      Launch workers until no job has been found for x seconds, then declare a failure.

Further work
------------
* Refactoring:
  * Use co/bluebird in tests/index.js
  * Use co/bluebird in producer.js
* Tests:
  * Refactor enabling/disabling of console log by using a `logger` function in `worker.js`


