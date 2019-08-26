import { createProxy, MethodCall, LoggerConfig, MethodOverride } from "./index"

const testObject = {
  value: 1,
  method: function() {
    return this.value
  },
  exceptMethod: function() {
    throw new Error("something went wrong")
  },
  fulfilledPromise(x: any) {
    return new Promise(resolve => {
      setTimeout(() => resolve(x), 1)
    })
  },
  failedPromise() {
    return new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error("rejected")), 1)
    })
  }
}

function wrap(config?: LoggerConfig) {
  let details: MethodCall | undefined
  const ret = {
    details,
    proxied: createProxy(
      testObject,
      actualDetails => {
        ret.details = actualDetails
      },
      config
    )
  }
  return ret
}

test("proxy intercepts method call", () => {
  const wrapped = wrap()
  const res = wrapped.proxied.method()
  expect(res).toBe(1)
  expect(wrapped.details).toBeDefined()
  expect(wrapped.details!.resolvedPromise).toBe(false)
  expect(wrapped.details!.result).toBe(1)
})

test("call survives errors in callback", () => {
  const proxied = createProxy(testObject, () => {
    throw new Error("broken callback")
  })

  proxied.method()
})

test("proxy doesn't intercept property access", () => {
  let intercepted: boolean = false
  const proxied = createProxy(testObject, () => {
    intercepted = true
  })
  expect(proxied.value).toBe(1)
  expect(intercepted).toBe(false)
})

test("callback called on error", () => {
  const wrapped = wrap()
  try {
    wrapped.proxied.exceptMethod()
    fail("exception should be raised")
  } catch (e) {}
  expect(wrapped.details).toBeDefined()
  expect(wrapped.details!.error).toBeDefined()
  expect(wrapped.details!.resolvedPromise).toBe(false)
})

test("Async callback", async () => {
  const wrapped = wrap()

  return wrapped.proxied.fulfilledPromise("foo").then(() => {
    if (!wrapped.details) fail("callback not invoked")
    expect(wrapped.details!.result).toBe("foo")
    expect(wrapped.details!.methodName).toBe("fulfilledPromise")
    expect(wrapped.details!.resolvedPromise).toBe(true)
  })
})

test("Async callback with errors", () => {
  const wrapped = wrap()
  return wrapped.proxied
    .failedPromise()
    .then(() => fail("promise chould have been rejected"))
    .catch(() => {
      if (!wrapped.details) fail("callback not invoked")
      expect(wrapped.details!.result).toBeUndefined()
      expect(wrapped.details!.error).toBeDefined()
      expect(wrapped.details!.error!.message).toBe("rejected")
      expect(wrapped.details!.resolvedPromise).toBe(true)
    })
})

test("Async callback without proxy resolution", () => {
  const wrapped = wrap({ resolvePromises: false })

  return wrapped.proxied
    .failedPromise()
    .then(() => fail("promise should have been rejected"))
    .catch(() => {
      if (!wrapped.details) fail("callback not invoked")
      expect(typeof wrapped.details!.result).toBe("object")
      expect(wrapped.details!.error).toBeUndefined()
      expect(wrapped.details!.resolvedPromise).toBe(false)
      return wrapped.details!.result!.catch((err: Error) => {
        expect(err.message).toBe("rejected")
      })
    })
})

test("Override", () => {
  const config = {
    resolvePromises: false,
    methodsOverride: new Map<string, MethodOverride>()
  }
  const wrapped = wrap(config)
  config.methodsOverride.set("method", () => 2)
  config.methodsOverride.set("failedPromise", (name: string, target, args) => {
    const result = target[name].apply(target, args)
    return result.catch((err: Error) => {
      throw new Error(`msg:${err.message}`)
    })
  })

  const value = wrapped.proxied.method()
  expect(value).toBe(2)

  return wrapped.proxied
    .failedPromise()
    .then(() => fail("promise chould have been rejected"))
    .catch(() => {
      if (!wrapped.details) fail("callback not invoked")
      expect(typeof wrapped.details!.result).toBe("object")
      expect(wrapped.details!.error).toBeUndefined()
      expect(wrapped.details!.resolvedPromise).toBe(false)
      return wrapped.details!.result!.catch((err: Error) => {
        expect(err.message).toBe("msg:rejected")
      })
    })
})
