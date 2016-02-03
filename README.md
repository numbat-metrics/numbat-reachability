# numbat-reachability
Send metrics describing whether a thing is reachable.

Say your thing depends on a Redis running somewhere. You want to know whether
that Redis is up or not. `numbat-reachability` sends a metric with value 1 if
it is, 0 otherwise.

## Usage
```js
var Reachability = require('numbat-reachability')
Reachability({
  uri: 'tcp://127.0.0.1:3337',
  hosts: [
    'redis://:my-super-secure-redis-password@redis-1-west.internal.example.com',
    'http://another-microservice.internal.example.com'
  ]
})
```
