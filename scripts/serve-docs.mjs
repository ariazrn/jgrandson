import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "website", "dist");
const port = Number(process.env.JG_DOCS_PORT || 4174);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const candidate = normalize(join(root, relative));

  if (candidate !== root && !candidate.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const file = statSync(candidate).isDirectory() ? join(candidate, "index.html") : candidate;
    const size = statSync(file).size;
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Content-Length": size,
      "Cache-Control": "no-cache",
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`JGrandson docs: http://localhost:${port}`);
});
