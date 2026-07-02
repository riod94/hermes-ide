const API_BASE = window.location.origin;

export interface ProfileInfo {
  name: string;
  role: string;
  port: number;
}

export interface AuthResponse {
  success: boolean;
  profile: ProfileInfo;
  error?: string;
}

export async function login(name: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  return res.json();
}

function authHeader(name: string, password: string): Record<string, string> {
  return { "X-Auth": `${name}:${password}`, "Content-Type": "application/json" };
}

export async function listProfiles(name: string, password: string): Promise<{ profiles: ProfileInfo[] }> {
  const res = await fetch(`${API_BASE}/api/profiles`, {
    headers: authHeader(name, password),
  });
  return res.json();
}

export async function addProfile(adminName: string, adminPass: string, profileName: string, profilePass: string, role: string = "developer") {
  const res = await fetch(`${API_BASE}/api/profiles`, {
    method: "POST",
    headers: authHeader(adminName, adminPass),
    body: JSON.stringify({ name: profileName, password: profilePass, role }),
  });
  return res.json();
}

export async function updateProfilePassword(adminName: string, adminPass: string, profileName: string, newPass: string) {
  const res = await fetch(`${API_BASE}/api/profiles`, {
    method: "PUT",
    headers: authHeader(adminName, adminPass),
    body: JSON.stringify({ name: profileName, password: newPass }),
  });
  return res.json();
}

export async function removeProfile(adminName: string, adminPass: string, profileName: string) {
  const res = await fetch(`${API_BASE}/api/profiles?name=${profileName}`, {
    method: "DELETE",
    headers: authHeader(adminName, adminPass),
  });
  return res.json();
}

export async function updateProfileRole(adminName: string, adminPass: string, profileName: string, newRole: string) {
  const res = await fetch(`${API_BASE}/api/profiles`, {
    method: "PATCH",
    headers: authHeader(adminName, adminPass),
    body: JSON.stringify({ name: profileName, role: newRole }),
  });
  return res.json();
}

export async function deploy(adminName: string, adminPass: string) {
  const res = await fetch(`${API_BASE}/api/deploy`, {
    method: "POST",
    headers: authHeader(adminName, adminPass),
  });
  return res.json();
}

export async function getMyProfile(name: string, password: string): Promise<{ profile: ProfileInfo }> {
  const res = await fetch(`${API_BASE}/api/profiles/me`, {
    headers: authHeader(name, password),
  });
  return res.json();
}

export async function changeMyPassword(name: string, currentPassword: string, oldPassword: string, newPassword: string) {
  const res = await fetch(`${API_BASE}/api/profiles/me/password`, {
    method: "PUT",
    headers: authHeader(name, currentPassword),
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  return res.json();
}
