import { Server } from "../src";
import type { Request, Response, NextFunction } from "express";

const bearerAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.split(" ")[1];
  if (token !== "secret") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

const server = new Server({
  port: 3000,
  id: "main",
  controllersDir: "example/controllers",
  enableSwagger: true,
  securityHandlers: {
    bearerAuth: bearerAuth,
  },
});

await server.init();
