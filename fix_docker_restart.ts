import { join } from "path";
import { spawn } from "bun";

async function restart() {
  const cwd = join(import.meta.dir, "apps/code-server-infra");
  console.log("Recreating containers...");
  const proc = spawn(["docker", "compose", "up", "-d"], { cwd, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  console.log(out, err);
}
restart();
