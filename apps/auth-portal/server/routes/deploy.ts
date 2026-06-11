import { loadStore, saveStore } from "../lib/store";
import { writeDockerCompose, restartContainers } from "../lib/docker";

function authenticate(req: Request): { authorized: boolean; role?: string } {
  const auth = req.headers.get("x-auth");
  if (!auth) return { authorized: false };

  const [name, password] = auth.split(":");
  const store = loadStore();
  const profile = store.profiles.find((p) => p.name === name && p.password === password);
  if (!profile) return { authorized: false };

  return { authorized: true, role: profile.role };
}

export async function handleDeploy(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const session = authenticate(req);
  if (!session.authorized || session.role !== "admin") {
    return Response.json({ error: "Unauthorized — admin only" }, { status: 403 });
  }

  try {
    const store = loadStore();

    // 1. Generate docker-compose.yml
    writeDockerCompose(store);

    // 2. Restart containers
    const result = await restartContainers();

    return Response.json({
      success: result.success,
      message: result.success
        ? "Docker compose generated and containers restarted"
        : "Docker compose generated but restart failed",
      output: result.output,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
