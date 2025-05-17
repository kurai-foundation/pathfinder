import { Handler, MountStrategy, Params, Node, HttpMethod, RouteParams } from "~/types"

/**
 * Lightweight, high‑performance HTTP router for Node.js and browsers,
 * written in TypeScript with zero dependencies
 */
export default class Pathfinder {
  /** Fast path for fully static routes. */
  private staticRoutes: Record<string, Record<string, Handler>> = {}
  /** Root of the dynamic routing tree. */
  private root: Node = { children: {}, handlers: {} }

  /** Fixed-size least-recently-added cache for look-ups. */
  private cache = new Map<string, { handler: Handler; params: Params }>()
  private readonly cacheSize = 1_000

  /**
   * Register a route handler.
   *
   * @param method HTTP method (GET, POST, etc.)
   * @param path Route path, may contain :param, *tail or *pre*suf tokens.
   * @param handler Handler to invoke once the route matches.
   */
  public register<Path extends string>(method: HttpMethod, path: Path, handler: Handler<Path>) {
    const _path = this.trim(path)

    // Purely static route: store in the constant-time table and return.
    if (!/[:*]/.test(_path)) {
      (this.staticRoutes[_path] ??= {})[method] = handler
      return
    }

    // Otherwise walk or build the dynamic tree.
    const segments = _path.slice(1).split("/")
    let node = this.root

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]

      // Anonymous wildcard that matches exactly one segment.
      if (seg === "*") {
        node = (node.paramChild ??= { name: "*", node: { children: {}, handlers: {} } }).node
        continue
      }

      // Named :param.
      if (seg.startsWith(":")) {
        const name = seg.slice(1)
        node = (node.paramChild ??= { name, node: { children: {}, handlers: {} } }).node
        continue
      }

      // *tail or *tail.ext      → consumes the rest of the URL.
      if (seg.startsWith("*")) {
        const tailName = seg.slice(1)

        // *suffix.ext pattern
        if (tailName.includes(".")) {
          const list = (node.globChildren ??= [])
          let child = list.find(g => g.prefix === "" && g.suffix === tailName)
          if (!child) {
            child = {
              prefix: "", suffix: tailName, name: "*",
              node: { children: {}, handlers: {} }
            }
            list.push(child)
          }
          node = child.node
          break
        }

        // Plain *tail
        node = (node.tailChild ??= {
          name: tailName || "*",
          node: { children: {}, handlers: {} }
        }).node
        break
      }

      // *pre*suf glob inside the same segment.
      const pos = seg.indexOf("*")
      if (pos > 0) {
        const pre = seg.slice(0, pos)
        const suf = seg.slice(pos + 1)
        const list = (node.globChildren ??= [])
        let child = list.find(g => g.prefix === pre && g.suffix === suf)
        if (!child) {
          child = {
            prefix: pre, suffix: suf, name: "*",
            node: { children: {}, handlers: {} }
          }
          list.push(child)
        }
        node = child.node
        break
      }

      // Static literal segment.
      node = node.children[seg] ??= { children: {}, handlers: {} }
    }
    // Finally attach the handler to the leaf node.
    node.handlers[method] = handler
  }

  /**
   * Mount another router under a fixed prefix.
   *
   * @param prefix URL prefix at which `child` should be mounted.
   * @param child Router to mount.
   * @param strategy Delegate (default) or Copy.
   */
  public mount(prefix: string, child: Pathfinder, strategy: MountStrategy = MountStrategy.Delegate) {
    const clean = this.trim(prefix)

    // Copy strategy enumerates and re-registers all routes.
    if (strategy === MountStrategy.Copy) {
      for (const { method, path, handler } of child.exportRoutes()) {
        const dst = clean === "/" ? path : this.join(clean, path)
        this.register(method, dst, handler)
      }
      return
    }

    // Delegate strategy attaches the child router at a tree node.
    const segments = clean === "/" ? [] : clean.slice(1).split("/")
    let node = this.root
    for (const s of segments) node = node.children[s] ??= { children: {}, handlers: {} }
    node.mounted = { router: child, prefixLen: clean === "/" ? 0 : clean.length }
  }

  /**
   * Resolve a request path to its handler and path parameters.
   *
   * @param method HTTP method.
   * @param raw Raw request path, may include or omit a trailing slash.
   * @returns `{ handler, params }` on success or `null` if not found.
   */
  public lookup(method: HttpMethod, raw: string) {
    const path = this.trim(raw)
    const key = `${method}:${path}`

    // Fast path: hit LRU cache.
    const hit = this.cache.get(key)
    if (hit) return hit

    // Fast path: fully static route.
    const sh = this.staticRoutes[path]?.[method]
    if (sh) return this.memo(key, sh, {})

    // Slow path: walk the dynamic tree.
    const res = this.walk(this.root, path, method)
    if (res?.handler) return this.memo(key, res.handler, res.params)

    return null
  }

  /**
   * Export every registered route as a flat list.
   * Useful for documentation, testing and copy mounting.
   */
  public exportRoutes() {
    const out: { method: string; path: string; handler: Handler }[] = []

    // Collect static routes.
    for (const [p, mset] of Object.entries(this.staticRoutes))
      for (const [m, h] of Object.entries(mset)) out.push({ method: m, path: p, handler: h })

    // Depth-first search through the dynamic tree.
    const dfs = (n: Node, segs: string[]) => {
      for (const [m, h] of Object.entries(n.handlers))
        out.push({ method: m, path: "/" + segs.join("/"), handler: h })

      for (const [k, c] of Object.entries(n.children)) dfs(c, [...segs, k])
      if (n.paramChild) dfs(n.paramChild.node, [...segs, ":" + n.paramChild.name])
      if (n.tailChild) dfs(n.tailChild.node, [...segs, "*" + n.tailChild.name])
      if (n.globChildren)
        for (const g of n.globChildren)
          dfs(g.node, [...segs, g.prefix + "*" + g.suffix])
    }
    dfs(this.root, [])
    return out
  }

  /**
   * Internal tree traversal.
   *
   * @param node Current tree node.
   * @param path Remaining request path (always starts with /).
   * @param method HTTP method being resolved.
   */
  private walk(node: Node, path: string, method: string):
    { handler?: Handler; params: Params } | null {

    const params: Params = Object.create(null)

    // Check mounted sub-router at the current level.
    if (node.mounted) {
      const d = node.mounted.router.lookup(method, path)
      if (d) return d
    }

    // If this is exactly the current node.
    if (path === "/")
      return node.handlers[method] ? { handler: node.handlers[method], params } : null

    // Iterative manual parsing to avoid split allocations.
    let i = 1, L = path.length, cur = node
    while (true) {
      // Find next slash.
      let j = i
      while (j < L && path.charCodeAt(j) !== 47) j++
      const seg = path.slice(i, j)
      const atEnd = j === L

      // Static child.
      if (cur.children[seg]) cur = cur.children[seg]

      // :param child.
      else if (cur.paramChild) {
        params[cur.paramChild.name] = seg
        cur = cur.paramChild.node
      }

      // *pre*suf glob children.
      else if (cur.globChildren) {
        let ok = false
        for (const g of cur.globChildren)
          if (seg.startsWith(g.prefix) && seg.endsWith(g.suffix)) {
            params[g.name] = seg.slice(g.prefix.length, seg.length - g.suffix.length)
            cur = g.node
            ok = true
            break
          }
        if (!ok) return null
      }

      // *tail child.
      else if (cur.tailChild) {
        params[cur.tailChild.name] = path.slice(i)
        cur = cur.tailChild.node
        break
      }

      // No match.
      else return null

      // Delegate if a router is mounted on the matched node.
      if (cur.mounted) {
        const rest = atEnd ? "/" : path.slice(j)
        const sub = cur.mounted.router.lookup(method, rest)
        if (sub) return { handler: sub.handler, params: { ...params, ...sub.params } }
      }

      if (atEnd) break
      i = j + 1
    }
    return { handler: cur.handlers[method], params }
  }

  /**
   * Insert a new entry into the cache and evict the oldest one if needed.
   */
  private memo(key: string, handler: Handler, params: Params) {
    if (this.cache.size >= this.cacheSize)
      this.cache.delete(this.cache.keys().next().value!)
    this.cache.set(key, { handler, params })
    return { handler, params }
  }

  /** Remove a trailing slash unless the path is just "/". */
  private trim(p: string) { return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p }

  /** Join two path fragments while preserving exactly one slash. */
  private join(a: string, b: string) {
    if (a === "/") return b
    if (a.endsWith("/") && b.startsWith("/")) return a + b.slice(1)
    if (!a.endsWith("/") && !b.startsWith("/")) return a + "/" + b
    return a + b
  }
}