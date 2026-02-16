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

const oauthHandler = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader === "Bearer oauth-token") {
    (req as any).user = { id: "oauth-user", scope: "read" };
    return next();
  }
  res.status(401).json({ error: "OAuth Unauthorized" });
};

const server = new Server({
  port: 3000,
  id: "main",
  controllersDir: "example/controllers",
  enableSwagger: true,
  devMode: true,
  securityHandlers: {
    bearerAuth: bearerAuth,
    oauth2: oauthHandler,
  },
  swaggerPath: "/docs",
  securitySchemes: {
    oauth2: {
      type: "oauth2",
      flows: {
        implicit: {
          authorizationUrl: "https://example.com/api/oauth/dialog",
          scopes: {
            "read:profile": "read your profile",
            "write:profile": "modify your profile",
          },
        },
      },
    },
  },
});

await server.init();
