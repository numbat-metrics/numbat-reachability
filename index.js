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
    cb(null, false)
  }, DEFAULT_TIMEOUT)

  var req = module.request({
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
    var timeout = setTimeout(function () {
      socket.destroy()
      cb(null, false)
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
    redis.createClient(url.format(url))
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

      results.forEach(function (result, i) {
        emitter.metric({
          name: 'reachability',
          value: result ? 1 : 0,
          target: stripAuth(options.hosts[i])
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
