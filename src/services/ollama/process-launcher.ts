import fs = require("node:fs");
import path = require("node:path");
const { spawn } = require("node:child_process");

function resolveExecutablePath(executable: string) {
  const trimmedExecutable = executable.trim();
  if (!trimmedExecutable) return null;
  if (path.isAbsolute(trimmedExecutable) && fs.existsSync(trimmedExecutable)) return trimmedExecutable;
  const candidateNames = process.platform === "win32" && path.extname(trimmedExecutable) === ""
    ? [`${trimmedExecutable}.exe`, `${trimmedExecutable}.cmd`, `${trimmedExecutable}.bat`]
    : [trimmedExecutable];
  for (const directory of (process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const name of candidateNames) {
      const candidate = path.join(directory, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function getLaunchSpec() {
  const executable = process.env.OLLAMA_EXECUTABLE?.trim() || "ollama";
  const resolved = resolveExecutablePath(executable);
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (!env.OLLAMA_MODELS && resolved) {
    const installationModels = path.join(path.dirname(resolved), "models");
    const defaultModels = path.join(process.env.USERPROFILE || "", ".ollama", "models");
    if (fs.existsSync(installationModels)) env.OLLAMA_MODELS = installationModels;
    else if (defaultModels && fs.existsSync(defaultModels)) env.OLLAMA_MODELS = defaultModels;
  }
  if (process.platform === "win32" && process.env.OLLAMA_LAUNCH_MODE?.trim().toLowerCase() === "app" && resolved) {
    const appExecutable = path.join(path.dirname(resolved), "ollama app.exe");
    if (fs.existsSync(appExecutable)) return { command: appExecutable, args: [], env, label: appExecutable };
  }
  return { command: executable, args: ["serve"], env, label: resolved || executable };
}

async function launchOllamaProcess() {
  const { command, args, env, label } = getLaunchSpec();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, env, stdio: "ignore", windowsHide: true });
    child.once("error", (error: NodeJS.ErrnoException) => reject(error.code === "ENOENT" ? new Error(`Could not find the Ollama executable: ${label}`) : error));
    child.once("spawn", () => {
      console.info(`[ollama] Started process ${child.pid ?? "unknown"}: ${label}${args.length ? ` ${args.join(" ")}` : ""}`);
      child.once("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        if (code !== 0 || signal) {
          console.warn(`[ollama] Process ${child.pid ?? "unknown"} exited (code: ${code ?? "none"}, signal: ${signal ?? "none"}).`);
        }
      });
      child.unref();
      resolve();
    });
  });
}

module.exports = { launchOllamaProcess };
