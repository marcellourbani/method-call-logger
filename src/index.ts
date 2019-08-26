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
  resolvePromises: boolean
): any {
  return function(...args: any[]) {
    const call = {
      methodName,
      resolvedPromise: false,
      ...measure(curMethod, target, args)
    }
    if (resolvePromises) handlePromises(call, callback)
    else eatException(callback, call)
    if (call.error) throw call.error
    return call.result
  }
}

export function createProxy<T>(
  baseObject: T,
  callback: loggerCB,
  resolvePromises = true
) {
  const handler = {
    get(target: any, propKey: any) {
      const curMethod = target[propKey]
      if (typeof curMethod === "function")
        return wrap(curMethod, propKey, target, callback, resolvePromises)
      return curMethod
    }
  }
  return new Proxy(baseObject, handler) as T
}
