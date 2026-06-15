import { loadStore, saveStore } from "../lib/store";
import { writeDockerCompose, restartContainers, restartContainer, writeNginxConfig, reloadNginx, installExtensionOnContainer, injectMcpConfig, deployMcpServices } from "../lib/docker";

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
    const steps: Record<string, { success: boolean; message: string; details?: string[] }> = {};

    // ── Step 1: Generate docker-compose.yml ──
    // Includes MCP_SERVICE_URL env var + extra_hosts for container→host MCP access
    writeDockerCompose(store);
    steps.docker_compose = { success: true, message: "Generated docker-compose.yml" };

    // ── Step 2: Restart containers ──
    const containerResult = await restartContainers();
    steps.containers = {
      success: containerResult.success,
      message: containerResult.success
        ? "All containers restarted"
        : `Container restart issues: ${containerResult.output}`,
    };

    // ── Step 3: Generate & deploy Nginx config ──
    // Includes /mcp proxy to systemd MCP service on host (127.0.0.1:56xxx)
    writeNginxConfig(store);
    const nginxResult = await reloadNginx();
    steps.nginx = {
      success: nginxResult.success,
      message: nginxResult.output,
    };

    // ── Step 4: Deploy MCP systemd services ──
    // Generates env files, installs unit template, enables & starts per-profile services
    const mcpServiceResult = await deployMcpServices(store);
    steps.mcp_services = {
      success: mcpServiceResult.success,
      message: mcpServiceResult.output,
    };

    // ── Step 5: Install extension to containers ──
    // Wait for containers to be ready
    await new Promise(r => setTimeout(r, 5000));

    let extSuccessCount = 0;
    const extDetails: string[] = [];
    for (const profile of store.profiles) {
      const ok = await installExtensionOnContainer(profile.name);
      if (ok) {
        extSuccessCount++;
        extDetails.push(`${profile.name}: installed`);
      } else {
        extDetails.push(`${profile.name}: FAILED`);
      }
    }
    steps.extension = {
      success: extSuccessCount === store.profiles.length,
      message: `Extension installed in ${extSuccessCount}/${store.profiles.length} containers`,
      details: extDetails,
    };

    // ── Step 6: Restart containers for extension reload ──
    for (const profile of store.profiles) {
      await restartContainer(`hermes-ide-${profile.name}`);
    }
    // Wait before MCP config injection
    await new Promise(r => setTimeout(r, 3000));

    // ── Step 7: Inject MCP config ke Hermes profiles ──
    // Sets mcp_servers.ide.url in each profile's config.yaml
    const mcpConfigResult = injectMcpConfig(store);
    steps.mcp_config = {
      success: mcpConfigResult.success === mcpConfigResult.total,
      message: `MCP config injected in ${mcpConfigResult.success}/${mcpConfigResult.total} profiles`,
      details: mcpConfigResult.details,
    };

    // ── Summary ──
    const allSuccess = Object.values(steps).every(s => s.success);

    return Response.json({
      success: allSuccess,
      message: allSuccess
        ? "Full deploy completed successfully"
        : "Deploy completed with some issues — check step details",
      steps,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
