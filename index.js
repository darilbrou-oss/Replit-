const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");

const apiServerDir = path.resolve(__dirname, "artifacts/api-server");

console.log("╔══════════════════════════════════════╗");
console.log("║      Discord Bot — Démarrage...      ║");
console.log("╚══════════════════════════════════════╝");

console.log("\n[1/2] Build TypeScript...");
try {
  execFileSync("node", ["build.mjs"], {
    stdio: "inherit",
    cwd: apiServerDir,
  });
} catch (err) {
  console.error("[ERREUR] Build échoué :", err.message);
  process.exit(1);
}

console.log("\n[2/2] Démarrage du serveur et du bot Discord...");

const server = spawn(
  "node",
  ["--enable-source-maps", "dist/index.mjs"],
  {
    stdio: "inherit",
    cwd: apiServerDir,
    env: {
      ...process.env,
      PORT: process.env.PORT || "3000",
    },
  },
);

server.on("error", (err) => {
  console.error("[ERREUR] Impossible de démarrer le serveur :", err.message);
  process.exit(1);
});

server.on("exit", (code, signal) => {
  if (code !== 0) {
    console.error(`[ERREUR] Serveur arrêté (code: ${code}, signal: ${signal})`);
    process.exit(code ?? 1);
  }
});

process.on("SIGTERM", () => {
  console.log("[Arrêt] Signal SIGTERM reçu...");
  server.kill("SIGTERM");
});

process.on("SIGINT", () => {
  console.log("[Arrêt] Signal SIGINT reçu...");
  server.kill("SIGTERM");
});
