import { writeFileSync } from "node:fs";
import { register } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const hookPath = path.join(tmpdir(), "pm-today-page-tsx-hook.mjs");

type TodayPageModule = {
  default: (props: {
    searchParams: Promise<{
      project?: string;
      date?: string;
      card?: string;
      list?: string;
    }>;
  }) => Promise<ReactNode>;
};

let registered = false;
let pageModule: Promise<TodayPageModule> | undefined;

function registerPageLoader(): void {
  if (registered) return;
  writeFileSync(hookPath, pageLoaderHook(projectRoot));
  register(pathToFileURL(hookPath).href, pathToFileURL(hookPath));
  registered = true;
}

export async function renderTodayPage(
  databasePath: string,
  query: {
    project?: string;
    date?: string;
    card?: string;
    list?: string;
  } = {},
): Promise<string> {
  process.env.PM_SQLITE_PATH = databasePath;
  registerPageLoader();
  pageModule ??= import("../../app/page.tsx") as Promise<TodayPageModule>;
  const page = await pageModule;
  const element = await page.default({
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(element);
}

function pageLoaderHook(root: string): string {
  return `
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(${JSON.stringify(path.join(root, "package.json"))});
const ts = require("typescript");
const root = ${JSON.stringify(root)};
const exts = [".tsx", ".ts", ".js", ".mjs"];

function resolveFile(base) {
  const candidates = [];
  if (path.extname(base)) candidates.push(base);
  else {
    for (const ext of exts) candidates.push(base + ext);
    for (const ext of exts) candidates.push(path.join(base, "index" + ext));
  }
  for (const candidate of candidates) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/navigation" || specifier === "next/navigation.js") {
    return {
      url: pathToFileURL(path.join(root, "node_modules/next/navigation.js")).href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : root;
    const base = specifier.startsWith("/")
      ? specifier
      : path.resolve(path.dirname(parent), specifier);
    const file = resolveFile(base);
    if (file && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
      return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".tsx") || url.endsWith(".ts")) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, "utf8");
    const jsx = filename.endsWith(".tsx");
    const out = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: jsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
`;
}
