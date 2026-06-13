// Captura de telas (Playwright). Faz login no gate e fotografa cada rota em
// página inteira, salvando em screenshots/. Rodar a partir de /tmp/pw (onde o
// playwright + chromium estão instalados):
//   bun /Users/dheiver/Documents/vivo-compliance-insights-1/scripts/shoot.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOOT_BASE || "http://localhost:8097";
const OUT = "/Users/dheiver/Documents/vivo-compliance-insights-1/screenshots";
const PASSWORD = process.env.SHOOT_PASSWORD || "vivo-2026";

// Públicas (capturadas ANTES do login).
const publicRoutes = [
  ["01-landing", "/"],
  ["02-login", "/login"],
];
// Internas (exigem sessão).
const appRoutes = [
  ["03-dashboard", "/dashboard"],
  ["04-audios", "/audios"],
  ["05-ligacoes", "/calls"],
  ["06-equipe", "/team"],
  ["07-coaching", "/coaching"],
  ["08-scorecards", "/scorecards"],
  ["09-relatorios", "/relatorios"],
  ["10-configuracoes", "/settings"],
  ["11-agentes", "/agents"],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function shoot(name, path) {
  const url = BASE + path;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  } catch {
    await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch(() => {});
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("✓", name, path);
}

// 1) Públicas.
for (const [name, path] of publicRoutes) await shoot(name, path);

// 2) Login.
await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.fill("#password", PASSWORD).catch(() => {});
await page.click("button[type=submit]").catch(() => {});
await page.waitForTimeout(2500);

// 3) Internas.
for (const [name, path] of appRoutes) await shoot(name, path);

await browser.close();
console.log("Done →", OUT);
