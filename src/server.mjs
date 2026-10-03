import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assess, getRegistry } from "./lib/assess.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "../web");
const PORT = Number(process.env.PORT || 8787);

function send(res, status, body, type = "application/json") {
  const data = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      return send(
        res,
        200,
        readFileSync(join(WEB, "index.html"), "utf8"),
        "text/html; charset=utf-8",
      );
    }
    if (req.method === "GET" && url.pathname === "/app.css") {
      return send(
        res,
        200,
        readFileSync(join(WEB, "app.css"), "utf8"),
        "text/css; charset=utf-8",
      );
    }
    if (req.method === "GET" && url.pathname === "/app.js") {
      return send(
        res,
        200,
        readFileSync(join(WEB, "app.js"), "utf8"),
        "text/javascript; charset=utf-8",
      );
    }
    if (req.method === "GET" && url.pathname === "/api/universe") {
      return send(res, 200, { securities: getRegistry().list() });
    }
    if (req.method === "POST" && url.pathname === "/api/assess") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      try {
        const result = assess({
          symbol: body.symbol,
          as_of: body.as_of,
          position: body.position || { state: "NOT_HELD" },
        });
        return send(res, 200, result);
      } catch (e) {
        const status = e.code === "NON_EOD_AS_OF" ? 400 : e.code === "UNKNOWN_SECURITY" ? 404 : 400;
        return send(res, status, { error: e.message, code: e.code || "ASSESS_ERROR" });
      }
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`IDE V1 assessment server http://127.0.0.1:${PORT}`);
});
