### Pathfinder HTTP Router

Pathfinder is a lightweight _(~4.0kb)_, high‑performance HTTP router for Node.js and browsers,
written in TypeScript. It delivers sub‑microsecond route resolution by combining `O(1)`
lookups for static routes with a compact trie for parameterized paths.

An optional LRU cache accelerates repeated requests, and you can mount child
routers under any base path using delegate or copy strategies — all
with **zero external dependencies**.

```ts
import Pathfinder, { MountStrategy } from "@kurai-io/pathfinder"

const router = new Pathfinder()

router.register("GET", "/", () => ({ message: "Hello!" }))
router.register("GET", "/users/:id", ({ params }) => ({ id: params.id }))

const match = router.lookup("GET", "/users/42")
if (match) {
  const { handler, params } = match
  console.log(handler({ params })) // → { id: "42" }
}

// Mount another router under '/v2'
const v2 = new Pathfinder()
v2.register("GET", "/items", () => [1, 2, 3])
router.mount("/v2", v2, MountStrategy.Copy)
```

## Mount Strategies

### Delegate

Attaches a reference to a child `Pathfinder` at a single node in the trie.
Incoming requests that match the mount prefix are forwarded (`lookup`) into the child
router, preserving its own routing tables and cache. This uses minimal memory but
incurs an extra function call per mount.

### Copy

Walks through all routes of the child router via `exportRoutes()` and re-registers
them under the parent’s trie with the mount prefix prepended. This yields faster
lookups (no delegation overhead) but duplicates route entries and increases memory use.

## Internal Principles

**Static route table**: a plain-object map from trimmed path strings to handlers for constant-time O(1) dispatch.

**LRU Cache**: recent `lookup(pathRaw)` results (handler + params) are cached in insertion order map; on cache hit, the
entry is moved to the end. When capacity is exceeded, the oldest is evicted.

**Trie traversal**: if no static or cache hit, the router walks a prefix tree (`children` for static segments, single
`paramChild` for dynamic segments) in one pass over the URL segments, collecting parameter values on the way. Mounted
routers are invoked if encountered mid-traversal.

## Benchmark Comparison

Following benchmarks where taken under Node v24.0.2, on an Apple MacBook Pro M4 Pro 12C and represents 
operations per second for each routing type and framework.

> Benchmark is not an indicator that any framework is worse or better. Any framework that
can perform >1M ops/s already fits most modern production projects, and you will hardly
see a difference between 1M and 10M ops/s

| Benchmark           | pathfinder      | hono (node) | koa-tree-router | find-my-way |
|---------------------|-----------------|-------------|-----------------|-------------|
| Short static        | **174,821,861** | 109,583,138 | 69,474,236      | 49,879,976  |
| Static (same radix) | **175,252,326** | 123,069,728 | 29,058,941      | 15,376,204  |
| Dynamic             | **158,388,869** | 19,463,353  | 14,016,807      | 6,034,499   |
| Mixed               | **161,300,510** | 21,616,371  | 16,510,855      | 7,738,542   |
| Long static         | **148,986,703** | 123,865,982 | 30,311,289      | 16,897,184  |
| Wildcard            | **156,484,928** | 35,454,298  | 18,744,649      | 10,537,618  |
| All together        | **8,946,472**   | 6,586,999   | 3,484,485       | 1,762,148   |

_Original benchmark code by Tomas Della Vedova available at https://github.com/delvedor/router-benchmark_


_Note: this benchmark is not the same benchmark available in the `benchmarks` folder_

## License

You can copy and paste the MIT license summary from below.

```text
MIT License

Copyright (c) 2022-2025 Kurai Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```
