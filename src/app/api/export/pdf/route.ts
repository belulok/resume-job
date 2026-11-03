import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

export const maxDuration = 60;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const globalForBrowser = globalThis as unknown as { __cvBrowser?: Promise<Browser> };

function getBrowser(): Promise<Browser> {
  const executablePath = CHROME_CANDIDATES.find((p): p is string => !!p && existsSync(p));
  if (!executablePath) {
    throw new Error("No Chrome/Chromium found. Set CHROME_PATH in .env.local.");
  }
  const cached = globalForBrowser.__cvBrowser;
  if (cached) return cached;
  const launching = puppeteer
    .launch({ executablePath, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] })
    .then((browser) => {
      browser.on("disconnected", () => {
        globalForBrowser.__cvBrowser = undefined;
      });
      return browser;
    })
    .catch((e) => {
      globalForBrowser.__cvBrowser = undefined;
      throw e;
    });
  globalForBrowser.__cvBrowser = launching;
  return launching;
}

function safeFilename(name: string) {
  return (name || "resume").replace(/[^\w\- .]+/g, "").trim().slice(0, 80) || "resume";
}

export async function POST(request: Request) {
  const resume = await request.json().catch(() => null);
  if (!resume || typeof resume !== "object") {
    return Response.json({ error: "Invalid resume." }, { status: 400 });
  }

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 501 });
  }

  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument((data) => {
      (window as unknown as { __RESUME__: unknown }).__RESUME__ = data;
    }, resume);
    const origin = new URL(request.url).origin;
    await page.goto(`${origin}/print`, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.waitForFunction("window.__PRINT_READY__ === true", { timeout: 30_000 });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const filename = safeFilename((resume as { title?: string }).title ?? "resume");
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[api/export/pdf]", e);
    return Response.json({ error: `PDF rendering failed: ${(e as Error).message}` }, { status: 500 });
  } finally {
    await page.close().catch(() => {});
  }
}
