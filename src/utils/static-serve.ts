/**
 * Static file serving helpers for Bun (path traversal safe, index.html fallback).
 */
import { join, normalize } from "node:path";

const noCacheHeaders = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function underWebRoot(webRoot: string, candidate: string): string | null {
  const resolved = normalize(candidate);
  const base = normalize(webRoot);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

export async function serveStaticFile(
  webRoot: string,
  pathname: string,
): Promise<Response> {
  let rel = pathname === "/" ? "index.html" : pathname.slice(1);
  rel = rel.replace(/\.\./g, "");
  const candidate = underWebRoot(webRoot, join(webRoot, rel));
  if (!candidate) return new Response("Not found", { status: 404 });

  let file = Bun.file(candidate);
  if (!(await file.exists())) {
    const dir = join(webRoot, rel);
    const idx = join(dir, "index.html");
    const idxNorm = underWebRoot(webRoot, idx);
    if (idxNorm && (await Bun.file(idxNorm).exists())) {
      file = Bun.file(idxNorm);
    } else {
      return new Response("Not found", { status: 404 });
    }
  }

  return new Response(file, {
    headers: {
      ...noCacheHeaders,
      "Content-Type": contentType(candidate),
    },
  });
}

export function tlsFromEnv():
  | { cert: ReturnType<typeof Bun.file>; key: ReturnType<typeof Bun.file> }
  | undefined {
  const certPath = process.env.SSL_CERTFILE;
  const keyPath = process.env.SSL_KEYFILE;
  if (!certPath || !keyPath) return undefined;
  return { cert: Bun.file(certPath), key: Bun.file(keyPath) };
}
