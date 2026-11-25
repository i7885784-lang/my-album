import { spawn } from "node:child_process";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error("Требуется Node.js 22.13 или новее. https://nodejs.org/");
  process.exit(1);
}
const port = process.env.PORT || "3000",
  url = "http://localhost:" + port;
try {
  const r = await fetch(url + "/api/health", {
    signal: AbortSignal.timeout(1000),
  });
  if ((await r.json()).app === "family-albums") {
    console.log("Сервер уже запущен: " + url);
    openBrowser();
    process.exit(0);
  }
  console.error(
    "Порт " +
      port +
      " занят другим приложением. Закройте его или измените PORT.",
  );
  process.exit(1);
} catch {}
const child = spawn(
  process.execPath,
  ["--import", "tsx", "backend/server.ts"],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  },
);
let opened = false;
const timer = setInterval(async () => {
  try {
    const r = await fetch(url + "/api/health", {
      signal: AbortSignal.timeout(1000),
    });
    if ((await r.json()).app === "family-albums") {
      clearInterval(timer);
      opened = true;
      openBrowser();
    }
  } catch {}
}, 500);
const timeout = setTimeout(() => {
  if (!opened) {
    console.error("Сервер не ответил за 60 секунд. Проверьте сообщения выше.");
    child.kill();
  }
}, 60000);
child.on("exit", (code) => {
  clearInterval(timer);
  clearTimeout(timeout);
  process.exit(code || 0);
});
process.on("SIGINT", () => child.kill("SIGINT"));
function openBrowser() {
  const command =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, args, { stdio: "ignore" });
  browser.on("error", () => console.log("Откройте " + url + " в браузере."));
  browser.unref();
}
