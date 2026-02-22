# @synchjs/ewb (Express Web Server Base)

A powerful, type-safe Express.js wrapper designed for rapid backend development. It features integrated Swagger documentation, CORS, Rate Limiting, JWT Authorization, and elegant TypeScript Decorators.

## Key Features

- **Class-Based Controllers**: Build highly semantic architectures with `@Controller`.
- **REST Decorators**: Ready to use `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch` bindings.
- **Integrated Swagger API**: Auto-generating and interactive docs, instantly accessible via `/docs`.
- **Authorization Middlewares**: Use `@Authorize(secret)` and `@AuthRequired()` to protect endpoints gracefully with JSON Web Tokens.
- **Pre-configured Safety**: CORS and Rate Limiting options embedded in the builder core.
- **Auto Config Injection**: Controllers map automatically using modern Stack Traces.

## Installation

```bash
bun add @synchjs/ewb
# or
npm install @synchjs/ewb
```

## Quick Start

```typescript
import { Server, Controller, Get, AuthRequired } from "@synchjs/ewb";

@Controller("/users", ["Users"])
export class UserController {
  @Get("/", { summary: "Get all users" })
  public list(req: any, res: any) {
    res.json({ users: ["John Doe"] });
  }

  @AuthRequired()
  @Get("/private", { summary: "Access private user data" })
  public profile(req: any, res: any, next: any, user: any) {
    res.json({ secretMessage: "Hello!", payload: user });
  }
}

// Start Server
const app = new Server(3000)
  .setCors({ origin: "*" })
  .setSwagger(true)
  .setRateLimit({ limit: 100, windowMs: 15 * 60 * 1000 });

app.init();
```

## Documentation

Configure the Builder using `new Server(port)` and its chaining methods `.setCors(...)`, `.setSwagger(...)` and `.setRateLimit(...)`. If no controllers directory is specified via `.setControllers(...)`, the server automatically scans and registers code inside the `./controllers` folder next to the entry file.
