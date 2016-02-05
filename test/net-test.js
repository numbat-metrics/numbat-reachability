var net = require('net')
var assert = require('assert')
var JSONStream = require('json-stream')
var Producer = require('../')

var TARGET_PORT = 9998
var ANALYZER_PORT = 10000

var stopProducer = Producer({
  uri: 'tcp://127.0.0.1:' + ANALYZER_PORT,
  hosts: [
    'tcp://127.0.0.1:' + TARGET_PORT
  ],
  interval: 100
})

var targetServer = net.createServer(function (sock) {
  sock.end()
})

var analyzerServer = net.createServer(function (sock) {
  var events = []
  sock
    .pipe(new JSONStream())
    .on('readable', function () {
      var event = this.read()
      events.push(event)
      if (events.length === 1) {
        assert.equal(event.value, 0)
        targetServer.listen(TARGET_PORT)
      }
      else if (events.length === 2) {
        assert.equal(event.value, 1)
        stopProducer()
        sock.end()
        targetServer.close()
        analyzerServer.close()
      }
    })
}).listen(ANALYZER_PORT)
