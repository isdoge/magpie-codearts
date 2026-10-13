// magpie-codearts: the agent module that puts CodeArts on magpie's Agents
// page, as OpenCode-family agents go there.
//
// CodeArts is an OpenCode fork whose config lives at
// ~/.codeartsdoer/codearts_cli.json and whose model field takes
// provider/model. magpie wires it the way it wires OpenCode itself: a
// "magpie" provider block pointing at the gateway, and model
// "magpie/<catalog ref>".
//
// Two CodeArts quirks make a plain provider block not enough:
//   - CodeArts keeps a whitelist, enabled_providers, that its own startup
//     recomputes: a list written into the file is discarded, so "magpie"
//     never survives a restart unless a plugin's config hook adds it back.
//   - every export of a CodeArts plugin file must be a function: an object
//     export silently kills the whole plugin, so this file — which must
//     export an agent object for magpie — can never serve as that plugin.
// So connect() also points CodeArts at this package's main (index.mjs),
// whose config hook both registers the CodeArts provider and keeps
// "magpie" on the whitelist.
//
// The provider block carries no apiKey: the gateway on this machine takes
// any key, and a written one gets encrypted on first use (enc:v3:…),
// which would leave magpie unable to tell its own wiring from the user's.

export const agent = {
  id: "codearts",
  name: "CodeArts",
  bin: "codearts",
  config: "~/.codeartsdoer/codearts_cli.json",
  model: "model",
  prefix: "magpie/",
  ua: ["codearts", "opencode"],
  notice: "CodeArts reads its settings when it starts: restart it to use the new model.",
}

// beside() is where this file is: the stack names the module moejs loaded,
// which is the installed copy of this package. The package's main
// (index.mjs) doubles as the CodeArts-side plugin — CodeArts resolves a
// path inside a package with a package.json to the package entry, so the
// bridge has to live there — so wiring points at the package directory.
function beside() {
  const m = /(?:file:\/\/)?(\/[^\s():]*)\/[^\s/:]+\.agent\.(?:js|mjs)/.exec(new Error().stack || "")
  return m ? m[1] : ""
}

// modelEntry is one model as OpenCode's config shapes it, the same fields
// magpie's own OpenCode wiring writes (agents.go, magpieProviderJSONAt).
function modelEntry(m) {
  const e = { name: m.name }
  if (m.images) {
    e.attachment = true
    e.modalities = { input: ["text", "image"], output: ["text"] }
  }
  // OpenCode compacts on a known window; an output of 0 is its own default
  if (m.context > 0) e.limit = { context: m.context, output: m.output }
  const reasons = m.efforts?.length
    ? ["low", "medium", "high"].every((l) => m.efforts.includes(l))
    : !!m.reasoning
  if (reasons) e.reasoning = true
  const variants = {}
  for (const ef of m.efforts || []) variants[ef] = { reasoningEffort: ef }
  if (Object.keys(variants).length) e.variants = variants
  return e
}

export function connect({ gateway, models }) {
  const out = {
    "provider.magpie": {
      npm: "@ai-sdk/openai-compatible",
      name: "magpie",
      options: { baseURL: gateway.v1 },
      models: Object.fromEntries(models.map((m) => [m.id, modelEntry(m)])),
    },
  }
  const pkg = beside()
  if (pkg) out.plugin = [pkg]
  return out
}
