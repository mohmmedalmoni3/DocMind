import { spawnSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
const python = path.join(
  root,
  ".voice-venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw result.error || new Error(`Speech setup failed (${result.status})`);
}
run(
  process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"),
  ["-m", "venv", ".voice-venv"],
);
run(python, ["-m", "pip", "install", "-r", "voice/requirements.txt"]);
run(python, ["voice/download.py"]);
