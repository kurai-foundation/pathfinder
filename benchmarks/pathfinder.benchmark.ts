import { Suite, Event } from "benchmark"
import { randomInt } from "node:crypto"
import Pathfinder from "../src/pathfinder"
import * as colors from "colors"

const args = require("args-parser")(process.argv)

const lite = args.lite === true || args.lite === "true"

const STATIC_EACH = lite ? 1 : 100
const PARAM_EACH = lite ? 1 : 100
const METHODS = lite ? ["GET"] : ["GET", "POST", "PUT", "PATCH", "OPTIONS", "TRACE", "DELETE"] as const

const randItem = <T, >(a: readonly T[]) => a[(Math.random() * a.length) | 0]
const fill = <T, >(n: number, fn: (i: number) => T) => Array.from({ length: n }, (_, i) => fn(i))

function materialize(tpl: string) {
  return tpl.replace(/:[^/]+/g, () => String(randomInt(100_000)))
}

const router = new Pathfinder()

const paramShort = fill(PARAM_EACH, i => `/v1/:id${ i }`)
const paramMedium = fill(PARAM_EACH, i => `/v1/users/:uid${ i }`)
const paramDeep = fill(PARAM_EACH, i => `/v1/a/:x${ i }/c/:y${ i }/z`)

const staticShort = fill(STATIC_EACH, i => `/v1/s${ i }`)
const staticMedium = fill(STATIC_EACH, i => `/v1/users/u${ i }`)
const staticDeep = fill(STATIC_EACH, i => `/v1/a/b/c/d/deep${ i }`)

for (const path of [
  ...staticShort, ...staticMedium, ...staticDeep,
  ...paramShort, ...paramMedium, ...paramDeep
]) {
  router.register(randItem(METHODS), path, () => null)
}

const mat = <T extends string[]>(arr: T) => arr.map(materialize)

const pathsStaticShort = mat(staticShort)
const pathsStaticMedium = mat(staticMedium)
const pathsStaticDeep = mat(staticDeep)

const pathsParamShort = mat(paramShort)
const pathsParamMedium = mat(paramMedium)
const pathsParamDeep = mat(paramDeep)

const pathsMixed = [
  ...pathsStaticShort,
  ...pathsStaticMedium,
  ...pathsStaticDeep,
  ...pathsParamShort,
  ...pathsParamMedium,
  ...pathsParamDeep
]

let iSS = 0, iSM = 0, iSD = 0,
  iPS = 0, iPM = 0, iPD = 0,
  iMX = 0

const lenSS = pathsStaticShort.length,
  lenSM = pathsStaticMedium.length,
  lenSD = pathsStaticDeep.length,
  lenPS = pathsParamShort.length,
  lenPM = pathsParamMedium.length,
  lenPD = pathsParamDeep.length,
  lenMX = pathsMixed.length

const suite = new Suite()

colors.enable()
console.log(
  colors.bgWhite(colors.black(` Benchmarking pathfinder `)),
  lite ? colors.bgGreen(colors.white(" LITE ")) : ""
)
colors.disable()

suite
  .add("Static short ", () => router.lookup("GET", pathsStaticShort[iSS = (iSS + 1) % lenSS]))
  .add("Static medium ", () => router.lookup("GET", pathsStaticMedium[iSM = (iSM + 1) % lenSM]))
  .add("Static deep ", () => router.lookup("GET", pathsStaticDeep[iSD = (iSD + 1) % lenSD]))
  .add("Dynamic short ", () => router.lookup("GET", pathsParamShort[iPS = (iPS + 1) % lenPS]))
  .add("Dynamic medium ", () => router.lookup("GET", pathsParamMedium[iPM = (iPM + 1) % lenPM]))
  .add("Dynamic deep ", () => router.lookup("GET", pathsParamDeep[iPD = (iPD + 1) % lenPD]))
  .add("Mixed ", () => router.lookup("GET", pathsMixed[iMX = (iMX + 1) % lenMX]))
  .on("cycle", (e: Event) => {
    colors.enable()

    const d = e.target.name!.padEnd(22, ".").split(" ")
    const name = d.slice(0, -1).join(" ").trim()
    const dots = d.slice(-1)[0].trim()

    const hz = e.target.hz!
    const mean = e.target.stats!.mean * 1e9

    const minOps = lite ? [10_000_000, 400_000] : [2_000_000, 10_000]
    const maxMean = lite ? [200, 300] : [500, 700]

    console.log(
      " ",
      colors.dim("↳"),
      colors.white(name),
      colors.dim(dots),
      colors[hz >= minOps[0] ? "green" : (hz <= minOps[1] ? "red" : "yellow")](`${ Number(Math.round(hz)).toLocaleString("en-US") } ops/sec`) + colors.dim(","),
      colors.dim(colors[mean < maxMean[0] ? "green" : mean > maxMean[1] ? "red" : "yellow"](`${ Number(Math.round(mean)).toLocaleString("en-US") } ns/op`) + ","),
      colors.dim(`(±${ e.target.stats!.rme.toFixed(2) }%)`)
    )
    colors.disable()
  })
  .run({ async: true })

