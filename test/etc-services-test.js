var test = require('tape')
var net = require('net')
var numock = require('numbat-collector-mock')
var etcServices = require('etc-services')

console.log(etcServices)


var Producer = require('../')
var TARGET_PORT = 9998
var ANALYZER_PORT = 10000

etcServices.irc[0] = TARGET_PORT

test("use etc services port",function(t){

  var collector = numock(ANALYZER_PORT)
  var stopProducer;

  net.createServer().once('connection',function (sock) {
    sock.end('OK')
    this.close();
    setTimeout(function(){
      stopProducer()
      collector.finished(function(err,metrics){
        t.ok(metrics.length > 1,'should have at least one metric')
        t.equals(metrics[0].name,'reachability')
        t.equals(metrics[0].value,1,'should be reachable')
        t.end()
      })
    },100)
  }).listen(TARGET_PORT,function(){
    stopProducer = Producer({
      uri: 'tcp://127.0.0.1:' + ANALYZER_PORT,
      hosts: [
        'irc://127.0.0.1'
      ],
      interval: 100
    })
  })

})




