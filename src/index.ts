export interface MethodOverride {
  (methodName: string, target: any, args: any[]): any
}
export type CallType = "get" | "set" | "method"
export type ObjectKey = string | number | symbol
export type MethodOverrideMap = Map<ObjectKey, MethodOverride>
export interface LoggerConfig {
  resolvePromises: boolean
  methodsOverride?: Map<string, MethodOverride>
  getterOverride?: Map<string, MethodOverride>
  setterOverride?: Map<string, MethodOverride>
}
export interface MethodCall {
  methodName: string
  arguments: any[]
  start: number
  duration: number
  failed: boolean
  resolvedPromise: boolean
  callType: CallType
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

function measure(
  curMethod: Method,
  target: any,
  args: any[],
  callType: CallType
) {
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
    callType,
    error
  }
}

function wrap(
  method: Method,
  methodName: string,
  target: any,
  callback: loggerCB,
  resolve: boolean,
  callType: CallType = "method"
): any {
  return function(...args: any[]) {
    const call = {
      methodName,
      resolvedPromise: false,
      ...measure(method, target, args, callType)
    }
    if (resolve) handlePromises(call, callback)
    else eatException(callback, call)
    if (call.error) throw call.error
    return call.result
  }
}

function completeConfig<T>(
  baseObject: any,
  config: LoggerConfig,
  properties: Map<string, PropertyDescriptor>
) {
  let { setterOverride, getterOverride } = config
  setterOverride = new Map((setterOverride && setterOverride.entries()) || [])
  getterOverride = new Map((getterOverride && getterOverride.entries()) || [])
  for (const entry of properties.entries()) {
    const [name, prop] = entry
    if (prop.get) {
      getterOverride.set(name, () => baseObject[name]) // defer evaluation
    }
    if (prop.set) {
      setterOverride.set(name, (nevValue: any) =>
        Reflect.set(baseObject, name, nevValue)
      )
    }
  }
  const methodsOverride = config.methodsOverride || new Map()
  return { ...config, methodsOverride, setterOverride, getterOverride }
}
const createSet = (
  cb: loggerCB,
  resolve: boolean,
  customSetters: MethodOverrideMap
) => (target: any, propKey: any, value: any, foo: any) => {
  const override = customSetters.get(propKey)
  const wrapped =
    override && wrap(override, propKey, target, cb, resolve, "set")
  if (override) return wrapped(value)
  return Reflect.set(target, propKey, value)
}

const createGet = (
  callback: loggerCB,
  resolve: boolean,
  getterOverride: MethodOverrideMap,
  methodsOverride: MethodOverrideMap
) => (target: any, propKey: any, foo: any) => {
  const getOverride = getterOverride.get(propKey)
  const wrapped =
    getOverride && wrap(getOverride, propKey, target, callback, resolve, "get")
  if (wrapped) return wrapped(propKey, target, [])
  const curMethod = target[propKey]
  if (typeof curMethod === "function") {
    const method = methodsOverride.get(propKey) || curMethod
    return wrap(method, propKey, target, callback, resolve)
  }
  return curMethod
}
export function createProxy<T>(
  baseObject: T,
  callback: loggerCB,
  config: LoggerConfig = { resolvePromises: true }
) {
  const properties = new Map<string, PropertyDescriptor>()
  Object.getOwnPropertyNames(baseObject).forEach(name => {
    const prop = Object.getOwnPropertyDescriptor(baseObject, name)
    if (prop) properties.set(name, prop)
  })
  const {
    resolvePromises,
    methodsOverride,
    getterOverride,
    setterOverride
  } = completeConfig(baseObject, config, properties)

  const handler = {
    set: createSet(callback, resolvePromises, setterOverride),
    get: createGet(callback, resolvePromises, getterOverride, methodsOverride)
  }

  return new Proxy(baseObject, handler) as T
}
