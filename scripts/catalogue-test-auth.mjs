// Local test-only Auth facade. REST uses real PostgREST/RLS on the synthetic DB.
// No production URLs, real accounts, outbound messages or third-party AI calls.
import http from "node:http";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
const secret = "synthetic-catalogue-test-jwt-secret-000000000";
const users = [1, 2, 3].map((i) => ({
  id: `10000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  email: `test${i}@synthetic.invalid`,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-10-10T00:00:00Z",
}));
const sessions = users.map((user) => {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      role: "authenticated",
      aud: "authenticated",
      iss: "http://localhost:54321/auth/v1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
      email: user.email,
    }),
  ).toString("base64url");
  const token = `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
  return {
    access_token: token,
    refresh_token: "synthetic-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    expires_in: 7200,
    token_type: "bearer",
    user,
  };
});
writeFileSync("/tmp/averomira-test-sessions.json", JSON.stringify(sessions), {
  mode: 0o600,
});
http
  .createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    if (req.url.startsWith("/auth/v1/user")) {
      const token = req.headers.authorization?.replace(/^Bearer /i, "");
      const user = sessions.find((s) => s.access_token === token)?.user;
      res.writeHead(user ? 200 : 401, { "content-type": "application/json" });
      res.end(JSON.stringify(user ?? { error: "synthetic unauthorized" }));
      return;
    }
    if (req.url.startsWith("/auth/v1/.well-known/jwks.json")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"keys":[]}');
      return;
    }
    if (!req.url.startsWith("/rest/v1/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 55432,
        path: req.url.slice("/rest/v1".length),
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("Synthetic REST unavailable");
    });
    req.pipe(upstream);
  })
  .listen(54321, "127.0.0.1", () =>
    console.log("Synthetic Auth/REST facade on localhost:54321"),
  );
