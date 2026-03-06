import fs from "fs";
import path from "path";

/**
 * Global teardown for E2E tests.
 * Cleans up auth state files created during setup.
 */
async function globalTeardown() {
  const authDir = path.join(__dirname, ".auth");
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log("Cleaned up auth state files");
  }
}

export default globalTeardown;
