import { Controller, Get, Post, Authorize, AuthRequired } from "../../src";
import type { Request, Response, NextFunction } from "express";

@Controller("/", ["Web"])
export class WebController {
  @Get("/")
  public home(req: Request, res: Response) {
    res.render("index.html");
  }
}

@Authorize("my_custom_secret")
@Controller("/users", ["Users"])
export class UserController {
  @Get("/", {
    summary: "Get all users and read token payload (optional auth)",
    responses: { 200: { description: "Returns a list of users" } },
  })
  public list(req: Request, res: Response, next: NextFunction, user?: any) {
    res.json({ users: ["John Doe", "Jane Doe"], currentUser: user || "Guest" });
  }

  @AuthRequired()
  @Post("/create", {
    summary: "Create a user (Auth required)",
    responses: { 200: { description: "User successfully created" } },
  })
  public create(req: Request, res: Response, next: NextFunction, user?: any) {
    res.json({ message: "User created", creator: user });
  }
}
