/**
 * Path Mapper — translates host-absolute paths to container-local paths.
 *
 * MCP Service runs on the host and sends file paths like:
 *   /home/ade/projects/rio/hermes-ide-extension/src/foo.ts
 *
 * Inside the code-server container, the volume mount is:
 *   /home/ade/projects/{profile} → /projects
 *
 * The env var HOST_PROJECTS_BASE (set in docker-compose) tells us
 * the exact host prefix to strip, e.g. "/home/ade/projects/rio".
 *
 * Container mount target is always /projects (from DEFAULT_WORKSPACE).
 */

const HOST_BASE = process.env.HOST_PROJECTS_BASE || "";
const CONTAINER_BASE = process.env.DEFAULT_WORKSPACE || "/projects";

/**
 * Translate a host-absolute path to a container-local path.
 *
 * Examples (HOST_PROJECTS_BASE=/home/ade/projects/rio):
 *   /home/ade/projects/rio/src/foo.ts → /projects/src/foo.ts
 *   /projects/src/foo.ts             → /projects/src/foo.ts  (unchanged)
 *   /some/other/path.ts              → /some/other/path.ts   (unchanged)
 *
 * If HOST_PROJECTS_BASE is not set (local dev), falls back to regex
 * matching /home/ade/projects/{any-profile}/...
 */
export function hostPathToContainer(hostPath: string): string {
  // Env-var based mapping (preferred — exact match)
  if (HOST_BASE && hostPath.startsWith(HOST_BASE)) {
    const relative = hostPath.slice(HOST_BASE.length); // e.g. "/src/foo.ts" or ""
    return `${CONTAINER_BASE}${relative}`;
  }

  // Fallback: regex for any /home/ade/projects/{profile}/ pattern
  const match = hostPath.match(/^\/home\/ade\/projects\/[^/]+(\/.*)?$/);
  if (match) {
    return `${CONTAINER_BASE}${match[1] || ""}`;
  }

  // Already a container path or unrecognized — return as-is
  return hostPath;
}
