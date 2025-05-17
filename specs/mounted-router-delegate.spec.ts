import { describe, expect, it } from "vitest"
import Pathfinder from "~/pathfinder"
import { MountStrategy } from "~/types"

describe("Should correctly register mounted routers in delegate mode", () => {
  const router = new Pathfinder()

  const v4 = new Pathfinder()
  const v4_2 = new Pathfinder()

  const routers = [router, v4, v4_2]

  routers.forEach((router, i) => router.register("GET", "/req", () => i + 1))

  v4.mount("/v4-2", v4_2, MountStrategy.Delegate)
  router.mount("/v4", v4, MountStrategy.Delegate)

  v4.register("GET", "/after", () => 99)

  it("should return correct handler for each route", () => {
    const _router = router.lookup("GET", "/req")
    const _v4 = router.lookup("GET", "/v4/req")
    const _v4_2 = router.lookup("GET", "/v4/v4-2/req")

    expect(_router?.handler?.({ params: {} })).toEqual(1)
    expect(_v4?.handler?.({ params: {} })).toEqual(2)
    expect(_v4_2?.handler?.({ params: {} })).toEqual(3)
  })

  it("Should return handler for routers registered after mount", () => {
    expect(router.lookup("GET", "/v4/after")?.handler?.({ params: {} })).toEqual(99)
  })
})