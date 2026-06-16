import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const profiles = ["default", "aziz", "giffari", "meysha", "renanda", "rianto", "rio", "ryan", "sabrino", "yudi"];

for (const profile of profiles) {
  const envPath = `/home/ade/.hermes/profiles/${profile}/.env`;
  try {
    const env = readFileSync(envPath, "utf-8");
    const newKey = require('crypto').createHash('sha256').update(profile + '2025_hermes_secret_key').digest('hex');
    const newEnv = env.replace(/API_SERVER_KEY=.*$/m, `API_SERVER_KEY=${newKey}`);
    writeFileSync(envPath, newEnv);
    if (profile !== 'default') {
      execSync(`systemctl --user restart hermes-gateway-${profile}.service`);
    } else {
      execSync(`systemctl --user restart hermes-gateway.service`);
    }
    console.log(`Updated ${profile} with key ${newKey}`);
  } catch (e) {
    console.error(`Failed ${profile}: ${e.message}`);
  }
}
