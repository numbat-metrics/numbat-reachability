var test = require('tape')
var Producer = require('../')
var numock = require('numbat-collector-mock')
var http = require('http')

var TARGET_PORT = 9999
var ANALYZER_PORT = 10000

test("can test http",function(t){
  var collector = numock(ANALYZER_PORT)
  var stopProducer = Producer({
    uri: 'tcp://127.0.0.1:' + ANALYZER_PORT,
    hosts: [
      'http://127.0.0.1:' + TARGET_PORT
    ],
    interval: 100
  })

  var requested = false

  http.createServer().once('request',function (req, res) {
    console.log('http req')

    res.writeHead(200)
    res.end()
    this.close()
    setTimeout(function(){
      stopProducer()
      collector.finished(function(err,metrics){
        t.ok(!err, 'should not have collector error')
        t.ok(metrics.length >= 2, 'should have at least 2 metrics')

        t.equals(metrics[0].name,'reachability','should have reachability metric')
        t.equals(metrics[0].value,1,'should have reachability metric')
        t.equals(metrics[1].name,'reachability.poll-time','should have poll-time')
        t.ok(metrics[1].value > 0,'poll-time should be greater than 0')

        console.log(metrics)
        t.end() 
      })
    },100)
  }).listen(TARGET_PORT)
})



test('unreachable',function(t){

    var collector = numock(ANALYZER_PORT)

    stopProducer = Producer({
      uri: 'tcp://127.0.0.1:' + ANALYZER_PORT,
      hosts: [
        'http://127.0.0.1:' + TARGET_PORT
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


