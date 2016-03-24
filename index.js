'use strict'

var url = require('url')
var net = require('net')
var http = require('http')
var https = require('https')
var bole = require('bole')
var once = require('once')
var async = require('async')
var redis = require('redis')
var Emitter = require('numbat-emitter')
var etcServices = require('etc-services')

var DEFAULT_INTERVAL = 1000
var DEFAULT_TIMEOUT = 10000

function httpCheck(module, url, cb) {
  cb = once(cb)

  var timeout = setTimeout(function () {
    req.abort()
    cb(null, false,true)
  }, DEFAULT_TIMEOUT)

  var req = module.request({
    host: url.hostname,
    port: url.port,
    path: url.path,
    auth: url.auth,
    agent: false
  })
    .on('error', function (err) {
      clearTimeout(timeout)
      cb(null, false)
    })
    .on('response', function (res) {
      clearTimeout(timeout)
      cb(null, res.statusCode >= 100 && res.statusCode < 500)
    })

  req.end()
}

var checks = {
  tcp: function (url, cb) {
    var timeout = setTimeout(function () {
      socket.destroy()
      cb(null, false, true)
    }, DEFAULT_TIMEOUT);

    var socket = net.connect({
      host: url.hostname,
      port: url.port
    })
      .on('error', function (err) {
        clearTimeout(timeout)
        cb(null, false)
      })
      .on('connect', function () {
        clearTimeout(timeout)
        this.end()
        cb(null, true)
      })
  },
  http: function (url, cb) {
    httpCheck(http, url, cb)
  },
  https: function (url, cb) {
    httpCheck(https, url, cb)
  },
  redis: function (url, cb) {
    var timeout = setTimeout(function () {
      client.end()
      cb(null, false)
    }, DEFAULT_TIMEOUT);

    var client = redis.createClient(url.format(url))
      .on('error', function () {
        clearTimeout(timeout)
        this.end()
        cb(null, false)
      })
      .on('ready', function () {
        clearTimeout(timeout)
        this.end()
        cb(null, true)
      })
  }
}

function stripAuth(url_) {
  var parsed = url.parse(url_)
  delete parsed.auth
  return url.format(parsed)
}

var ReachabilityProducer = module.exports = function(options) {
  options.app = 'reachability';

  var emitter = new Emitter(options)
  var logger = options.logger || bole('numbat-reachability')
  var parsed = options.hosts.map(url.parse)

  function produceOne(host, next) {
    var start = Date.now()
    var proto = host.protocol.slice(0, -1)

    function done(err, result) {
      var latency = Date.now() - start
      var safeHost = stripAuth(host)

      if (err) {
        emitter.metric({
          name: 'reachability.error',
          target: safeHost
        })
      }
      else {
        emitter.metric({
          name: 'reachability',
          value: result ? 1 : 0,
          target: safeHost
        })

        emitter.metric({
          name: 'poll-time',
          value: latency,
          target: safeHost
        })
      }

      next(err, result, latency)
    }

    if (checks[proto]) checks[proto](host, done)
    else {
      if (etcServices[proto]) {
        logger.warn('guessing port for ' + proto)

        checks.tcp({
          hostname: host.hostname,
          protocol: 'tcp:',
          port: etcServices[proto][0]
        }, done)
      }
      else done(new Error('Unknown protocol: ' + proto))
    }
  }

  var intervals = {}
  var stopped = false

  parsed.forEach(function fn(host) {
    var start = Date.now()
    delete intervals[host] // if there was one, it doesn't exist anymore
    produceOne(host, function(err, result, latency){
      if(stopped) return
      intervals[host] = setTimeout(fn.bind(null, host), (options.interval || DEFAULT_INTERVAL) - latency)
    })
  })

  return function stop() {
    stopped = true
    Object.keys(intervals).map(function (k) {
      clearInterval(intervals[k])
    })
  }
}

module.exports.setDefaultTimeout = function(t){
  DEFAULT_TIMEOUT = t
}
