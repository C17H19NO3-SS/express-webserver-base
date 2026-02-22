import { Controller, Get, Post, Authorize, AuthRequired } from "../../src";

@Authorize("my_custom_secret")
@Controller("/users", ["Users"])
export class UserController {
  @Get("/", {
    summary: "Get all users and read token payload (optional auth)",
    responses: { 200: { description: "Returns a list of users" } },
  })
  public list(req: any, res: any, next: any, user: any) {
    res.json({ users: ["John Doe", "Jane Doe"], currentUser: user || "Guest" });
  }

  @AuthRequired()
  @Post("/create", {
    summary: "Create a user (Auth required)",
    responses: { 200: { description: "User successfully created" } },
  })
  public create(req: any, res: any, next: any, user: any) {
    res.json({ message: "User created", creator: user });
  }
}
