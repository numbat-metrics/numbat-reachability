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
    cb(null, false)
  }, DEFAULT_TIMEOUT)

  module.request({
    host: url.hostname,
    port: url.port,
    path: url.path,
    auth: url.auth,
  })
    .on('error', function (err) {
      clearTimeout(timeout)
      cb(null, false)
    })
    .on('response', function (res) {
      clearTimeout(timeout)
      cb(null, res.statusCode >= 100 && res.statusCode < 500)
    })
    .end()
}

var checks = {
  tcp: function (url, cb) {
    net.connect({
      host: url.hostname,
      port: url.port
    })
      .on('error', function (err) {
        cb(null, false)
      })
      .on('connect', function () {
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
    redis.createClient(url)
      .on('error', function () {
        this.end()
        cb(null, false)
      })
      .on('ready', function () {
        this.end()
        cb(null, true)
      })
  }
}

var ReachabilityProducer = module.exports = function(options) {
  var emitter = new Emitter(options)
  var logger = options.logger || bole('numbat-reachability')
  var parsed = options.hosts.map(url.parse)

  function produce() {
    async.map(parsed, function (host, next) {
      var proto = host.protocol.slice(0, -1)

      if (checks[proto]) checks[proto](host, next)
      else {
        if (etcServices[proto]) {
          logger.warn('guessing port for ' + proto)
          checks.tcp({
            hostname: host.hostname,
            protocol: 'tcp:',
            port: etcServices[proto][0]
          }, next)
        }
        else next(new Error('Unknown protocol: ' + proto))
      }
    }, function (err, results) {
      if (err) {
        return emitter.metric({
          name: 'reachability.error'
        })
      }

      results.forEach(function (result) {
        emitter.metric({
          name: 'reachability',
          value: result ? 1 : 0
        })
      })
    })
  }

  var interval = setInterval(produce, options.interval || DEFAULT_INTERVAL)
  produce()

  return function stop() {
    clearInterval(interval)
  }
}
