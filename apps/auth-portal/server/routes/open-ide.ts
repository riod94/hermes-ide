import { loadStore, getProfile } from "../lib/store";
import { getIdeUrl } from "../lib/docker";

const IDE_DOMAIN = process.env.IDE_DOMAIN || "ide.dev.nusa.work";

/**
 * Proxy login ke code-server — ambil session cookie, redirect browser user
 * 
 * Flow:
 * 1. User klik "Open IDE" di dashboard
 * 2. Frontend redirect browser ke /api/open-ide?name=xxx&token=yyy
 * 3. Backend POST ke code-server /login dengan password profil
 * 4. Ambil Set-Cookie dari response code-server
 * 5. Redirect browser ke code-server URL dengan cookie yang sudah di-set
 */
export async function handleOpenIDE(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(req.url);
  const profileName = url.searchParams.get("name");
  const token = url.searchParams.get("token"); // base64(name:password) dari admin session

  if (!profileName || !token) {
    return Response.json({ error: "Missing name or token" }, { status: 400 });
  }

  // Decode & validate admin/self auth
  let authName: string, authPass: string;
  try {
    const decoded = atob(token);
    [authName, authPass] = decoded.split(":");
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  const store = loadStore();
  const authProfile = getProfile(store, authName);
  if (!authProfile || authProfile.password !== authPass) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admin can open any IDE, developer can only open their own
  if (authProfile.role !== "admin" && authName !== profileName) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetProfile = getProfile(store, profileName);
  if (!targetProfile) {
    return Response.json({ error: `Profile '${profileName}' not found` }, { status: 404 });
  }

  // Determine host: use HTTPS subdomain via nginx reverse proxy
  // ide-{name}.app.dev.nusa.work → proxied to code-server on localhost:{port}
  const codeServerUrl = getIdeUrl(profileName); // https://ide-{name}.app.dev.nusa.work/
  const codeServerInternal = `http://localhost:${targetProfile.port}`;

  try {
    // Extract headers from client request to prevent session mismatch in code-server
    const clientHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    
    const userAgent = req.headers.get("user-agent");
    if (userAgent) {
      clientHeaders["User-Agent"] = userAgent;
    }
    
    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      clientHeaders["X-Forwarded-For"] = xForwardedFor;
    }
    
    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp) {
      clientHeaders["X-Real-IP"] = xRealIp;
    }

    // POST login to code-server (internal/localhost)
    const loginRes = await fetch(`${codeServerInternal}/login`, {
      method: "POST",
      headers: clientHeaders,
      body: `password=${encodeURIComponent(targetProfile.password)}`,
      redirect: "manual", // Don't follow redirect, we need the Set-Cookie
    });

    // Extract session cookie from code-server response
    const setCookie = loginRes.headers.get("set-cookie");
    if (!setCookie) {
      return Response.json({ error: "Failed to obtain session from code-server" }, { status: 502 });
    }

    // Parse cookie name and value
    const cookieParts = setCookie.split(";")[0]; // "code-server-session=..."

    // Cross-subdomain: Auth Portal (ide.app.dev.nusa.work) sets cookie for
    // code-server (ide-rio.app.dev.nusa.work). Both share parent domain .app.dev.nusa.work,
    // so setting Domain=.ide.dev.nusa.work makes the cookie available across subdomains.
    return new Response(null, {
      status: 302,
      headers: {
        "Location": codeServerUrl,
        "Set-Cookie": `${cookieParts}; Path=/; Domain=.${IDE_DOMAIN}; SameSite=Lax; Secure`,
      },
    });

  } catch (e: any) {
    return Response.json({ 
      error: `Failed to connect to code-server on port ${targetProfile.port}: ${e.message}` 
    }, { status: 502 });
  }
}
