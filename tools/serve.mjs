import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2] ?? 8080);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relativePath = urlPath === "/" ? "/index.html" : urlPath;
  const safeRelative = normalize(relativePath).replace(/^[\\/]+/, "");
  let filePath = resolve(root, safeRelative);
  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }
  const type = mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`drAGhts dev server on http://127.0.0.1:${port}`);
});
