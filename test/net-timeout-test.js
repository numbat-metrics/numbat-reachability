var test = require('tape')
var numock = require('numbat-collector-mock')
var requireInject = require('require-inject')
var ee = require('events').EventEmitter

// load numbat-emiter so it can connect to numock.
require('numbat-emitter')

var TARGET_PORT = 9998
var ANALYZER_PORT = 10000


test("net timeout",function(t){

  // now make a producer with broken network.
  var Producer = requireInject('../index.js',{
    'net':{
      connect:function(){
        var e = new ee()
        e.destroy = function(){}
        e.write = function(){
        }
        return e
      }    
    }
  })

  Producer.setDefaultTimeout(10)
  
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

      t.equals(metrics[0].name,'reachability','should have correct name')
      t.equals(metrics[0].value,0,'should not be reachable')

      t.end()
    })
  })
  
})
