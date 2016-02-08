var test = require('tape')
var net = require('net')
var Producer = require('../')
var numock = require('numbat-collector-mock')

var TARGET_PORT = 9998
var ANALYZER_PORT = 10000

test("can test tcp",function(t){

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
        'tcp://127.0.0.1:' + TARGET_PORT
      ],
      interval: 100
    })
  })

})


test('unreachable',function(t){

    var collector = numock(ANALYZER_PORT)

    stopProducer = Producer({
      uri: 'tcp://127.0.0.1:' + ANALYZER_PORT,
      hosts: [
        'tcp://127.0.0.1:' + TARGET_PORT
      ],
      interval: 100
    })


    collector.once('data',function(){
      stopProducer()
      collector.finished(function(err,metrics){

        console.log(metrics)
        t.equals(metrics[0].name,'reachability','should have correct name')
        t.equals(metrics[0].value,0,'should not be reachable')

        t.end()
      })
    })

})
