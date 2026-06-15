import { loadStore, saveStore } from "../lib/store";
import { writeDockerCompose, restartContainers, restartContainer, writeNginxConfig, reloadNginx, installExtensionOnContainer, injectMcpConfig } from "../lib/docker";

function authenticate(req: Request): { authorized: boolean; role?: string } {
  const auth = req.headers.get("x-auth");
  if (!auth) return { authorized: false };

  const [name, ...rest] = auth.split(":");
  const password = rest.join(":");
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

    // 3. Generate & deploy nginx reverse proxy config
    writeNginxConfig(store);
    const nginxResult = await reloadNginx();

    // 4. Install extension to all containers
    let extSuccessCount = 0;
    // Wait for containers to be fully up before running exec
    await new Promise(r => setTimeout(r, 5000));
    
    for (const profile of store.profiles) {
      const ok = await installExtensionOnContainer(profile.name);
      if (ok) extSuccessCount++;
    }

    // 5. Restart containers agar code-server load extension baru
    for (const profile of store.profiles) {
      await restartContainer(`hermes-ide-${profile.name}`);
    }
    // Tunggu containers ready sebelum inject MCP config
    await new Promise(r => setTimeout(r, 3000));

    // 6. Inject MCP config ke Hermes profiles
    const mcpResult = injectMcpConfig(store);

    return Response.json({
      success: result.success,
      message: result.success
        ? "Docker compose generated and containers restarted"
        : "Docker compose generated but restart failed",
      output: result.output,
      nginx: {
        success: nginxResult.success,
        message: nginxResult.output,
      },
      extension: {
        success: extSuccessCount === store.profiles.length,
        message: `Extension installed in ${extSuccessCount}/${store.profiles.length} containers`
      },
      mcp: {
        success: mcpResult.success === mcpResult.total,
        message: `MCP config injected in ${mcpResult.success}/${mcpResult.total} profiles`,
        details: mcpResult.details,
      }
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
