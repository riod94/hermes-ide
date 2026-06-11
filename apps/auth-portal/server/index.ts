import { join } from "path";
import { existsSync } from "fs";
import { handleAuth } from "./routes/auth";
import { handleProfiles } from "./routes/profiles";
import { handleDeploy } from "./routes/deploy";

const STATIC_DIR = join(import.meta.dir, "../dist");
const PORT = 51000;

// MIME type map
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getMime(path: string): string {
  const ext = path.substring(path.lastIndexOf("."));
  return MIME[ext] || "application/octet-stream";
}

async function serveStatic(pathname: string): Promise<Response | null> {
  let filePath = join(STATIC_DIR, pathname);

  // SPA fallback: if file doesn't exist, serve index.html
  if (!existsSync(filePath)) {
    filePath = join(STATIC_DIR, "index.html");
    if (!existsSync(filePath)) return null;
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: { "Content-Type": getMime(filePath) },
  });
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // CORS headers for API
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Auth",
        },
      });
    }

    // API routes
    if (pathname === "/api/auth") {
      const res = await handleAuth(req);
      res.headers.set("Access-Control-Allow-Origin", "*");
      return res;
    }

    if (pathname === "/api/profiles") {
      const res = await handleProfiles(req);
      res.headers.set("Access-Control-Allow-Origin", "*");
      return res;
    }

    if (pathname === "/api/deploy") {
      const res = await handleDeploy(req);
      res.headers.set("Access-Control-Allow-Origin", "*");
      return res;
    }

    // Static files (Svelte build output)
    const staticRes = await serveStatic(pathname);
    if (staticRes) return staticRes;

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Auth Portal API running on http://0.0.0.0:${PORT}`);
