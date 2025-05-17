import Pathfinder from "~/pathfinder"

/**
 * Enum that defines how a child router should be mounted.
 *
 * Delegate  – keeps the child router intact and forwards look-ups to it.
 * Copy      – copies every route from the child into the parent at mount-time.
 */
export enum MountStrategy {
  Delegate = "delegate", Copy = "copy"
}

/** Run-time parameters extracted from a dynamic route segment. */
export type Params = Record<string, string>

export type ParamNames<Path extends string> = Path extends `${ infer _Start }:${ infer P }/${ infer R }`
  ? P | ParamNames<`/${ R }`>
  : Path extends `${ infer _Start }:${ infer P }`
    ? P
    : never

type PT<Path extends string> = Path extends `${ string }*${ string }`
  ? ParamNames<Path> | "*"
  : Path extends `${ string }*`
    ? ParamNames<Path> | "*"
    : ParamNames<Path>

export type RouteParams<Path extends string> = { [K in PT<Path>]: string }

/**
 * A handler receives the original request enriched with `params`
 * that were captured while resolving the route.
 */
export type Handler<Path extends string = any> = (req: { params: RouteParams<Path> } & { [k: string]: any }) =>
  any | Promise<any>

/** Helper shape for *pre*suf glob children. */
interface GlobChild {
  prefix: string
  suffix: string
  name: string
  node: Node
}

/** Http methods */
export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH" | string

/**
 * A single node of the radix-like routing tree.
 * Each node represents a single path segment.
 */
export interface Node {
  /** Static children keyed by literal segment value. */
  children: Record<string, Node>
  /** Single :param style child (only one per level). */
  paramChild?: { name: string; node: Node }
  /** Single *tail style child that consumes the rest of the path. */
  tailChild?: { name: string; node: Node }
  /** Zero or more glob *pre*suf children that match via prefix and suffix. */
  globChildren?: GlobChild[]
  /** Method -> handler table for the current path. */
  handlers: Record<HttpMethod | string, Handler>
  /** Optional mounted sub-router. */
  mounted?: { router: Pathfinder; prefixLen: number }
}