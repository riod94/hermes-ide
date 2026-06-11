import {
  loadStore,
  saveStore,
  addProfile,
  removeProfile,
  updatePassword,
  recalculatePorts,
  type ProfileStore,
} from "../lib/store";

function isAdmin(role: string): boolean {
  return role === "admin";
}

/** Extract admin session from X-Auth header (name:password) */
function authenticate(req: Request): { authorized: boolean; role?: string; name?: string } {
  const auth = req.headers.get("x-auth");
  if (!auth) return { authorized: false };

  const [name, password] = auth.split(":");
  const store = loadStore();
  const profile = store.profiles.find((p) => p.name === name && p.password === password);
  if (!profile) return { authorized: false };

  return { authorized: true, role: profile.role, name: profile.name };
}

export async function handleProfiles(req: Request): Promise<Response> {
  const session = authenticate(req);
  if (!session.authorized || !isAdmin(session.role!)) {
    return Response.json({ error: "Unauthorized — admin only" }, { status: 403 });
  }

  const url = new URL(req.url);

  // GET /api/profiles — list all
  if (req.method === "GET") {
    const store = loadStore();
    // hide passwords in list response, admin can see ports
    const profiles = store.profiles.map((p) => ({
      name: p.name,
      role: p.role,
      port: p.port,
    }));
    return Response.json({ profiles, meta: store.meta });
  }

  // POST /api/profiles — add profile
  if (req.method === "POST") {
    try {
      const body = await req.json() as { name: string; password: string; role?: string };
      const { name, password, role } = body;

      if (!name || !password) {
        return Response.json({ error: "Name and password required" }, { status: 400 });
      }

      let store = loadStore();
      store = addProfile(store, name.toLowerCase(), password, (role as any) || "developer");
      saveStore(store);

      return Response.json({ success: true, message: `Profile '${name}' added`, profiles: store.profiles.map((p) => ({ name: p.name, role: p.role, port: p.port })) });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  // PUT /api/profiles — update password
  if (req.method === "PUT") {
    try {
      const body = await req.json() as { name: string; password: string };
      const { name, password } = body;

      if (!name || !password) {
        return Response.json({ error: "Name and password required" }, { status: 400 });
      }

      let store = loadStore();
      store = updatePassword(store, name, password);
      saveStore(store);

      return Response.json({ success: true, message: `Password for '${name}' updated` });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  // DELETE /api/profiles?name=xxx — remove profile
  if (req.method === "DELETE") {
    const name = url.searchParams.get("name");
    if (!name) {
      return Response.json({ error: "Name query param required" }, { status: 400 });
    }

    try {
      let store = loadStore();
      store = removeProfile(store, name);
      saveStore(store);

      return Response.json({ success: true, message: `Profile '${name}' removed`, profiles: store.profiles.map((p) => ({ name: p.name, role: p.role, port: p.port })) });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
