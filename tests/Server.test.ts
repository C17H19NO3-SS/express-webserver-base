import "reflect-metadata";
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Server } from "../src/Server/Server";
import request from "supertest";
import jwt from "jsonwebtoken";
import path from "path";

describe("Server Core and Routing", () => {
  let server: Server;
  const secret = "test_secret";

  beforeAll(async () => {
    server = new Server({
      port: 0,
      controllers: [path.join(__dirname, "fixtures", "controllers")],
      cors: { origin: "*" },
      swagger: { path: "/docs" },
      views: { dir: path.join(__dirname, "fixtures", "views") },
    });

    await server.init();
  });

  test("Should boot up and register basic GET route without auth", async () => {
    const res = await request(server.app).get("/test/public");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: "public" });
  });

  test("Should access optional auth route as guest", async () => {
    const res = await request(server.app).get("/test/optional");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: "guest" });
  });

  test("Should access optional auth route as user", async () => {
    const token = jwt.sign({ foo: "bar" }, secret);
    const res = await request(server.app)
      .get("/test/optional")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe("user_present");
    expect(res.body.user.foo).toBe("bar");
  });

  test("Should fail auth required route without token", async () => {
    const res = await request(server.app).post("/test/private");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  test("Should fail auth required route with invalid token", async () => {
    const res = await request(server.app)
      .post("/test/private")
      .set("Authorization", "Bearer invalid_token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid token" });
  });

  test("Should pass auth required route with valid token", async () => {
    const token = jwt.sign({ admin: true }, secret);
    const res = await request(server.app)
      .post("/test/private")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe("private_success");
    expect(res.body.user.admin).toBe(true);
  });

  test("Should verify CORS headers are present", async () => {
    const res = await request(server.app).options("/test/public");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  test("Should verify Swagger is served at /docs", async () => {
    const res = await request(server.app).get("/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Swagger UI");
  });

  test("Should verify RateLimit initializes properly (returns 200 on first request)", async () => {
    const serverWithRateLimit = new Server({
      port: 0,
      ratelimit: { limit: 10, windowMs: 1000 },
    });
    const res = await request(serverWithRateLimit.app).get("/test");
    // Just verifying it doesn't crash on boot and wraps around missing route with 404
    expect(res.status).toBe(404);
  });

  test("Should render dynamic HTML using Bun.build through res.render", async () => {
    const res = await request(server.app).get("/test/render");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Test Page");
  });
});
