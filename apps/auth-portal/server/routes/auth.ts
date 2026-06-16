import { loadStore, getProfile } from "../lib/store";

export async function handleAuth(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await req.json() as { name: string; password: string };
    const { name, password } = body;

    if (!name || !password) {
      return Response.json({ error: "Name and password required" }, { status: 400 });
    }

    const store = loadStore();
    const profile = getProfile(store, name);

    if (!profile || profile.password !== password) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return Response.json({
      success: true,
      profile: {
        name: profile.name,
        role: profile.role,
        port: profile.port,
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message || "Bad request" }, { status: 400 });
  }
}
