export interface MethodOverride {
  (methodName: string, target: any, args: any[]): any
}
export interface LoggerConfig {
  resolvePromises: boolean
  methodsOverride?: Map<string, MethodOverride>
}
export interface MethodCall {
  methodName: string
  arguments: any[]
  start: number
  duration: number
  failed: boolean
  resolvedPromise: boolean
  result?: any
  error?: any // usually Error
}
export interface loggerCB {
  (call: MethodCall): void
}

const isPromise = <T>(p: any): p is Promise<T> => {
  return p && p === Promise.resolve(p)
}

function eatException(callback: loggerCB, call: MethodCall) {
  try {
    callback(call)
  } catch (ignore) {}
}
function handlePromises(call: MethodCall, callback: loggerCB) {
  const needResolution = isPromise(call.result)
  if (needResolution) {
    call.resolvedPromise = true
    call.result
      .then((res: any) => {
        call.result = res
        call.duration = Date.now() - call.start
        callback(call)
      })
      .catch((err: Error) => {
        call.result = undefined
        call.duration = Date.now() - call.start
        call.error = err
        call.failed = true
        callback(call)
      })
  } else eatException(callback, call)
  return needResolution
}
type Method = (...args: any[]) => any

function measure(curMethod: Method, target: any, args: any[]) {
  let failed = false
  const start = Date.now()
  let result, error
  try {
    result = curMethod.apply(target, args)
  } catch (exception) {
    failed = true
    error = exception
  }
  const duration = Date.now() - start
  return {
    arguments: args,
    start,
    duration,
    failed,
    result,
    error
  }
}

function wrap(
  curMethod: Method,
  methodName: string,
  target: any,
  callback: loggerCB,
  config: LoggerConfig
): any {
  return function(...args: any[]) {
    const overridden =
      config.methodsOverride && config.methodsOverride.get(methodName)
    const method = overridden
      ? () => overridden(methodName, target, args)
      : curMethod
    const call = {
      methodName,
      resolvedPromise: false,
      ...measure(method, target, args)
    }
    if (config.resolvePromises) handlePromises(call, callback)
    else eatException(callback, call)
    if (call.error) throw call.error
    return call.result
  }
}

export function createProxy<T>(
  baseObject: T,
  callback: loggerCB,
  config: LoggerConfig = { resolvePromises: true }
) {
  const handler = {
    get(target: any, propKey: any) {
      const curMethod = target[propKey]
      if (typeof curMethod === "function")
        return wrap(curMethod, propKey, target, callback, config)
      return curMethod
    }
  }
  return new Proxy(baseObject, handler) as T
}
