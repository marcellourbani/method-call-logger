import { createProxy, MethodCall } from "./index"

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

test("proxy intercepts method call", () => {
  let intercepted: boolean = false
  const proxied = createProxy(testObject, () => {
    intercepted = true
  })

  proxied.method()
  expect(intercepted).toBe(true)
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
  let intercepted: boolean = false
  const proxied = createProxy(testObject, () => {
    intercepted = true
  })
  try {
    proxied.exceptMethod()
    fail("exception should be raised")
  } catch (e) {}
  expect(intercepted).toBe(true)
})

test("Async callback", async () => {
  let details: MethodCall | undefined = undefined
  const proxied = createProxy(testObject, actualDetails => {
    details = actualDetails
  })

  return proxied.fulfilledPromise("foo").then(() => {
    if (!details) fail("callback not invoked")
    expect(details!.result).toBe("foo")
    expect(details!.methodName).toBe("fulfilledPromise")
  })
})

test("Async callback with errors", () => {
  let details: MethodCall | undefined = undefined
  const proxied = createProxy(testObject, actualDetails => {
    details = actualDetails
  })

  return proxied
    .failedPromise()
    .then(() => fail("promise chould have been rejected"))
    .catch(() => {
      if (!details) fail("callback not invoked")
      expect(details!.result).toBeUndefined()
      expect(details!.error).toBeDefined()
      expect(details!.error!.message).toBe("rejected")
    })
})

test("Async callback without proxy resolution", () => {
  let details: MethodCall | undefined = undefined
  const proxied = createProxy(
    testObject,
    actualDetails => {
      details = actualDetails
    },
    false
  )

  return proxied
    .failedPromise()
    .then(() => fail("promise chould have been rejected"))
    .catch(() => {
      if (!details) fail("callback not invoked")
      expect(typeof details!.result).toBe("object")
      expect(details!.error).toBeUndefined()
      return details!.result!.catch((err: Error) => {
        expect(err.message).toBe("rejected")
      })
    })
})
