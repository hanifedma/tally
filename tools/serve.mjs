// A static file server for working on Tally locally.
//
//     node tools/serve.mjs        → http://localhost:8080
//
// localhost counts as a secure origin, so Google sign-in, the service
// worker and crypto.subtle all behave exactly as they do in production.
// Opening index.html as a file:// URL does not, which is why this exists.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath rather than a URL's pathname: on Windows the two disagree
// about slashes and about the leading one before the drive letter, and the
// containment check below then rejects every path in the project.
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".sql": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    // Keep the server inside the project, whatever the request says.
    // normalize() resolves any ".." in the path; the check below is what
    // actually refuses one that climbed out.
    const full = join(ROOT, normalize(path));
    if (!full.startsWith(ROOT + sep) && full !== ROOT) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    await stat(full);
    const body = await readFile(full);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(full).toLowerCase()] || "application/octet-stream",
      // Never cache during development; a stale module is a bug you spend
      // an hour not finding.
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (e) {
    // Print it. A silent 404 during development is a minute of confusion
    // about the wrong thing.
    console.log("404 " + req.url + "  (" + (e.code || e.message) + ")");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1>");
  }
// Bound to the loopback address on purpose, not to every interface. This
// server has no authentication and serves the whole project directory; on a
// café or office network, listening on 0.0.0.0 would hand it to everyone
// else there. It is also why Windows never raises a firewall prompt for it —
// loopback needs no permission to accept a connection.
}).listen(PORT, "127.0.0.1", () => {
  console.log("Tally → http://localhost:" + PORT + "/");
  console.log("Tests → http://localhost:" + PORT + "/tests.html");
});
