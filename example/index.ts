import { Server, UserHandler } from "../src";
import type { Request, Response, NextFunction } from "express";

class MyUserHandler extends UserHandler {
  public async authenticate(req: Request) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      // Dummy check: if token is 'admin-token', user is admin
      if (token === "admin-token") {
        return { id: "admin-user", roles: ["admin"] };
      }
      if (token === "editor-token") {
        return { id: "editor-user", roles: ["editor"] };
      }
      if (token === "user-token") {
        return { id: "standard-user", roles: [] };
      }
    }
    return null;
  }

  public signin(req: Request, res: Response) {
    return { token: "user-token" };
  }

  public signup(req: Request, res: Response) {
    return { message: "Signed up!" };
  }

  public logout(req: Request, res: Response) {
    return { message: "Logged out!" };
  }
}

const server = new Server({
  port: 3000,
  id: "main",
  controllersDir: "example/controllers",
  viewsDir: "example/views",
  enableSwagger: true,
  swaggerPath: "/docs",
});

server.setUserHandler(new MyUserHandler());

await server.init();
