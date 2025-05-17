import { describe, expect, it } from "vitest"
import Pathfinder from "~/pathfinder"
import { MountStrategy } from "~/types"

describe("Should correctly register mounted routers in copy mode", () => {
  const router = new Pathfinder()

  const v2 = new Pathfinder()
  const v2_2 = new Pathfinder()

  const routers = [router, v2, v2_2]

  routers.forEach((router, i) => router.register("GET", "/req", () => i + 1))

  v2.mount("/v2-2", v2_2, MountStrategy.Copy)
  router.mount("/v2", v2, MountStrategy.Copy)

  v2.register("GET", "/after", () => 99)

  it("should return correct handler for each route", () => {
    const _router = router.lookup("GET", "/req")
    const _v2 = router.lookup("GET", "/v2/req")
    const _v2_2 = router.lookup("GET", "/v2/v2-2/req")

    expect(_router?.handler?.({ params: {} })).toEqual(1)
    expect(_v2?.handler?.({ params: {} })).toEqual(2)
    expect(_v2_2?.handler?.({ params: {} })).toEqual(3)
  })

  it("Should not return handler for routers registered after mount", () => {
    expect(router.lookup("GET", "/v2/after")).toBeNull()
  })
})