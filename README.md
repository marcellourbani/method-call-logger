[![Build Status](https://travis-ci.com/marcellourbani/method-call-logger.svg?branch=master)](https://travis-ci.com/marcellourbani/method-call-logger)
[![Downloads](https://badgen.net/npm/dt/method-call-logger)](https://www.npmjs.com/package/method-call-logger)

# Method call logger

A simple helper to log method calls to a given object
By default will resolve promises before calling the provided callback

Usage:

```typescript
import { createProxy, MethodCall } from "method-call-logger"

class Greeter {
  sayHello(target: string) {
    return `Hello,${target}`
  }
}

function logger(call: MethodCall) {
  if (call.result) console.log(JSON.stringify(call, null, 1))
}

const original = new Greeter()
const withLog = createProxy(original, logger)

original.sayHello("World") // nothing gets logged
withLog.sayHello("World") // logged to console
```

The output will look like:

```json
{
  "methodName": "sayHello",
  "arguments": ["World"],
  "start": 1566688156207,
  "duration": 0,
  "failed": false,
  "resolvedPromise": false,
  "result": "Hello,World"
}
```

## Configuration

An optional configuration object can be passed with two fields:

- resolvePromises: resolve promises before calling the log function (and set result/failed/error accordingly). Defaults to true
- methodsOverride: an optional map object to override the original method call. The result will be logged normally

```typescript
import {
  createProxy,
  MethodCall,
  LoggerConfig,
  MethodOverride
} from "method-call-logger"

class Greeter {
  sayHello(target: string) {
    return `Hello,${target}`
  }
}

function logger(call: MethodCall) {
  if (call.result) console.log(JSON.stringify(call, null, 1))
}

const original = new Greeter()
const config: LoggerConfig = {
  resolvePromises: false,
  methodsOverride: new Map<string, MethodOverride>()
}
config.methodsOverride!.set("sayHello", (name: string, target, args) => {
  //call the original method
  const result = target[name].apply(target, args)
  return `intercepted:${result}`
})

const withLog = createProxy(original, logger, config)

original.sayHello("World") // nothing gets logged, returns "Hello, World"
withLog.sayHello("World") // logged to console, returns "intercepted:Hello, World"
```

Will log the following to the console:

```json
{
  "methodName": "sayHello",
  "arguments": ["World"],
  "start": 1566688156207,
  "duration": 0,
  "failed": false,
  "resolvedPromise": false,
  "result": "intercepted:Hello,World"
}
```
