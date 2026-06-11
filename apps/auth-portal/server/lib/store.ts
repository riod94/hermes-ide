import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface Profile {
  name: string;
  password: string;
  role: "admin" | "developer";
  port: number;
}

export interface ProfileStore {
  meta: {
    auth_portal_port: number;
    base_port: number;
    fixed_profiles: Record<string, number>;
  };
  profiles: Profile[];
}

const DATA_PATH = join(import.meta.dir, "../../data/profiles.json");

export function loadStore(): ProfileStore {
  if (!existsSync(DATA_PATH)) {
    const initial: ProfileStore = {
      meta: { auth_portal_port: 51000, base_port: 51002, fixed_profiles: { default: 51001 } },
      profiles: [{ name: "default", password: "nusawork2025", role: "admin", port: 51001 }],
    };
    writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
}

export function saveStore(store: ProfileStore): void {
  writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

/**
 * Recalculate ports: default always 51001, rest sorted alphabetically from 51002+
 */
export function recalculatePorts(store: ProfileStore): ProfileStore {
  const defaultProfile = store.profiles.find((p) => p.name === "default");
  const others = store.profiles
    .filter((p) => p.name !== "default")
    .sort((a, b) => a.name.localeCompare(b.name));

  let port = store.meta.base_port; // 51002
  for (const p of others) {
    p.port = port++;
  }

  if (defaultProfile) {
    defaultProfile.port = store.meta.fixed_profiles["default"] || 51001;
  }

  store.profiles = defaultProfile ? [defaultProfile, ...others] : others;
  return store;
}

export function addProfile(store: ProfileStore, name: string, password: string, role: "admin" | "developer" = "developer"): ProfileStore {
  const exists = store.profiles.find((p) => p.name === name);
  if (exists) throw new Error(`Profile '${name}' already exists`);

  store.profiles.push({ name, password, role, port: 0 });
  return recalculatePorts(store);
}

export function removeProfile(store: ProfileStore, name: string): ProfileStore {
  if (name === "default") throw new Error("Cannot remove 'default' profile");
  store.profiles = store.profiles.filter((p) => p.name !== name);
  return recalculatePorts(store);
}

export function updatePassword(store: ProfileStore, name: string, password: string): ProfileStore {
  const profile = store.profiles.find((p) => p.name === name);
  if (!profile) throw new Error(`Profile '${name}' not found`);
  profile.password = password;
  return store;
}

export function getProfile(store: ProfileStore, name: string): Profile | undefined {
  return store.profiles.find((p) => p.name === name);
}
