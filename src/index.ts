export interface MethodCall {
  methodName: string
  arguments: any[]
  start: number
  duration: number
  failed: boolean
  result?: any
  error?: any // usually Error
}
export interface loggerCB {
  (call: MethodCall): void
}
export const isPromise = <T>(p: any): p is Promise<T> => {
  return p && p === Promise.resolve(p)
}

function handlePromises(call: MethodCall, callback: loggerCB) {
  const needResolution = isPromise(call.result)
  if (needResolution) {
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
  }
  return needResolution
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
        return function(...args: any[]) {
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
          const call = {
            methodName: propKey,
            arguments: args,
            start,
            duration,
            failed,
            result,
            error
          }
          // handle promises
          if (!(resolvePromises && handlePromises(call, callback)))
            try {
              callback(call)
            } catch (ignore) {}
          if (error) throw error
          return result
        }
      return curMethod
    }
  }
  return new Proxy(baseObject, handler) as T
}
