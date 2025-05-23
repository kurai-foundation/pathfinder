import { describe, expect, it } from "vitest"
import Pathfinder from "~/pathfinder"

describe("Should correctly register and lookup for routes", () => {
  const router = new Pathfinder()

  router.register("GET", "/user", () => 1)
  router.register("GET", "/user/:id", () => 2)
  router.register("GET", "/users/data/*/storage/*.html", () => 3)

  const v2 = new Pathfinder()
  v2.register("GET", "/profile", () => 4)

  router.mount("/v2", v2)

  it("should return correct handler for static path", () => {
    const match = router.lookup("GET", "/user")
    expect(match).not.toBeNull()
    expect(match?.handler?.({ params: {} })).toEqual(1)
  })

  it("should return correct handler for dynamic path", () => {
    const match = router.lookup("GET", "/user/23")
    expect(match).not.toBeNull()
    expect(match?.params.id).toEqual("23")
    expect(match?.handler?.({ params: match?.params })).toEqual(2)
  })

  it("should return correct handler for wildcard path", () => {
    const match = router.lookup("GET", "/users/data/internal/storage/index.html")
    const match2 = router.lookup("GET", "/users/data/internal/storage/index.js")

    expect(match2).toBeNull()
    expect(match).not.toBeNull()
    expect(match?.params["*"]).toEqual("index")
    expect(match?.handler?.({ params: match?.params })).toEqual(3)
  })

  it("should correctly process mounted routes in delegate mode", () => {
    const match = router.lookup("GET", "/v2/profile")
    expect(match?.handler?.({ params: match?.params })).toEqual(4)
  })

  it("should correctly lookup for routes mounted on same root", () => {
    const _r = new Pathfinder()
    const _r2 = new Pathfinder()
    const _r3 = new Pathfinder()

    _r2.register("GET", "/content", () => 1)
    _r3.register("GET", "/data", () => 2)

    _r.mount("/", _r2)
    _r.mount("/", _r3)

    const h2 = _r.lookup("GET", "/content")?.handler?.({} as any)
    const h3 = _r.lookup("GET", "/data")?.handler?.({} as any)

    expect(h2).toEqual(1)
    expect(h3).toEqual(2)
  })
})