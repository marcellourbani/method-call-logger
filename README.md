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
  "result": "Hello,World"
}
```
