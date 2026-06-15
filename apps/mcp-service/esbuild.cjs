const esbuild = require("esbuild");

const production = process.argv.includes("--minify");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    minify: production,
    sourcemap: false,
    platform: "node", // Bun is superset of Node
    target: "esnext",
    outfile: "dist/index.js",
    external: [], // Bundle everything — no node_modules at runtime
    banner: {
      js: "// Hermes MCP Service — run with: bun run dist/index.js",
    },
    logLevel: "info",
  });

  if (watch) {
    await ctx.watch();
    console.log("[mcp-service] Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("[mcp-service] Build complete → dist/index.js");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
