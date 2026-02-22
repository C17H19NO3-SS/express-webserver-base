import "reflect-metadata";
import { Controller, Get, Post, Authorize, AuthRequired } from "../../../src";

@Controller("/test", ["TestTag"])
export class DefaultTestController {
  @Get("/public")
  public getPublic(req: any, res: any) {
    res.json({ result: "public" });
  }

  @Authorize("test_secret")
  @Get("/optional")
  public getOptional(req: any, res: any, next: any, user: any) {
    if (user) {
      res.json({ result: "user_present", user });
    } else {
      res.json({ result: "guest" });
    }
  }

  @AuthRequired()
  @Authorize("test_secret")
  @Post("/private")
  public postPrivate(req: any, res: any, next: any, user: any) {
    res.json({ result: "private_success", user });
  }

  @Get("/render")
  public renderView(req: any, res: any) {
    res.render("test.html");
  }
}
