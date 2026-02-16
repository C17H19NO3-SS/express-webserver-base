import { Controller } from "../../src/Decorations/Controller";
import { Get, Post } from "../../src/Decorations/Methods";
import { BearerAuth, Public } from "../../src/Decorations/Authorized";
import type { Request, Response } from "express";
import { Serve } from "../../src/Decorations/Serve";
import { Tailwindcss } from "../../src/Decorations/Tailwind";

@Controller("", { tags: ["Example"] })
@BearerAuth()
@Tailwindcss()
export class ExampleController {
  @Get("/", {
    summary: "Serve the home page",
    description: "Returns the HTML content of the home page.",
    responses: {
      200: {
        description: "HTML content of the home page.",
        content: {
          "text/html": {
            schema: {
              type: "string",
            },
          },
        },
      },
    },
  })
  @Public()
  @Serve("example/views/src/index.html")
  public home(req: Request, res: Response) {}

  @Post("/echo", {
    summary: "Echo request body",
    description: "Returns the JSON body received in the request.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "The echoing response.",
        content: {
          "application/json": {
            schema: {
              type: "object",
            },
          },
        },
      },
      400: {
        description: "Bad Request",
      },
    },
  })
  @Public()
  public echo(req: Request, res: Response) {
    return req.body;
  }

  @Get("/secure", {
    summary: "Secure endpoint",
    description: "A secure endpoint requiring Bearer Token authentication.",
    responses: {
      200: {
        description: "Successful access to secure data.",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: { type: "string" },
              },
            },
          },
        },
      },
      401: {
        description: "Unauthorized",
      },
    },
  })
  public secure(req: Request, res: Response) {
    return { message: "This is a secure data", user: (req as any).user };
  }
}
