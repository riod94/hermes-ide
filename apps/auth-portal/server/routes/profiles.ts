import {
  loadStore,
  saveStore,
  addProfile,
  removeProfile,
  updatePassword,
  updateRole,
  type ProfileStore,
} from "../lib/store";
import { writeDockerCompose, restartContainer } from "../lib/docker";
import { sendDiscordNotification } from "../lib/discord";

function isAdmin(role: string): boolean {
  return role === "admin";
}

/** Extract admin session from X-Auth header (name:password) */
function authenticate(req: Request): { authorized: boolean; role?: string; name?: string } {
  const auth = req.headers.get("x-auth");
  if (!auth) return { authorized: false };

  const [name, ...rest] = auth.split(":");
  const password = rest.join(":"); // password bisa mengandung ':'
  const store = loadStore();
  const profile = store.profiles.find((p) => p.name === name && p.password === password);
  if (!profile) return { authorized: false };

  return { authorized: true, role: profile.role, name: profile.name };
}

/** GET /api/profile-names — public, returns only names for login dropdown */
export async function handleProfileNames(_req: Request): Promise<Response> {
  const store = loadStore();
  const names = store.profiles.map((p) => p.name);
  return Response.json({ names });
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

      writeDockerCompose(store);
      await restartContainer(`hermes-ide-${name.toLowerCase()}`);
      
      await sendDiscordNotification(`✅ **New Hermes IDE Profile Created**\n👤 User: \`${name.toLowerCase()}\`\n🔑 Role: \`${role || "developer"}\`\n🛠️ Container: \`hermes-ide-${name.toLowerCase()}\` is deploying...`);

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

      writeDockerCompose(store);
      await restartContainer(`hermes-ide-${name.toLowerCase()}`);
      
      await sendDiscordNotification(`🔑 **Hermes IDE Password Reset**\n👤 User: \`${name.toLowerCase()}\`\n🔄 Container \`hermes-ide-${name.toLowerCase()}\` has been restarted with new credentials.`);

      return Response.json({ success: true, message: `Password for '${name}' updated` });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  // PATCH /api/profiles — update role
  if (req.method === "PATCH") {
    try {
      const body = await req.json() as { name: string; role: string };
      const { name, role } = body;

      if (!name || !role) {
        return Response.json({ error: "Name and role required" }, { status: 400 });
      }

      if (role !== "admin" && role !== "developer") {
        return Response.json({ error: "Role must be 'admin' or 'developer'" }, { status: 400 });
      }

      let store = loadStore();
      store = updateRole(store, name, role as "admin" | "developer");
      saveStore(store);

      return Response.json({ success: true, message: `Role for '${name}' updated to '${role}'` });
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
