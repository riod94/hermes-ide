import { loadStore, getProfile } from "../lib/store";

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

  // Determine host: use the requesting host (not localhost) so it works from browser
  const requestHost = req.headers.get("host") || "localhost";
  const hostName = requestHost.split(":")[0]; // strip port if present
  const codeServerUrl = `http://${hostName}:${targetProfile.port}`;
  const codeServerInternal = `http://localhost:${targetProfile.port}`;

  try {
    // POST login to code-server (internal/localhost)
    const loginRes = await fetch(`${codeServerInternal}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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
    
    // Redirect browser to code-server with the session cookie set for code-server's domain/port
    // We use a small HTML page that sets the cookie via JS then redirects
    const html = `<!DOCTYPE html>
<html>
<head><title>Redirecting to IDE...</title></head>
<body>
<script>
  // Set the code-server session cookie for the target port
  document.cookie = "${cookieParts.replace(/"/g, '\\"')}; path=/; SameSite=Lax";
  window.location.href = "${codeServerUrl}/";
</script>
<noscript><a href="${codeServerUrl}/">Click here to continue</a></noscript>
</body>
</html>`;

    // But the cookie domain mismatch is a problem — cookies set from :51000 won't be sent to :51001
    // Solution: redirect to a special endpoint ON the code-server port that sets the cookie
    // Since we can't add endpoints to code-server, we use an iframe trick or just redirect with cookie in URL
    
    // Actually the cleanest approach: respond with redirect to code-server,
    // and set the cookie with the correct domain (same hostname, different port — cookies are NOT port-scoped!)
    // Cookies in HTTP are shared across ports on the same hostname.
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `${codeServerUrl}/`,
        "Set-Cookie": `${cookieParts}; Path=/; SameSite=Lax`,
      },
    });

  } catch (e: any) {
    return Response.json({ 
      error: `Failed to connect to code-server on port ${targetProfile.port}: ${e.message}` 
    }, { status: 502 });
  }
}
