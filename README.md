# @synchjs/ewb

A robust, decorator-based web server framework built on top of **Express** and optimized for **Bun**. It provides a structured way to build scalable APIs with built-in support for **OpenAPI (Swagger)**, **Validation**, **Custom User Management**, and **Frontend Asset Serving** with **HMR (Hot Module Replacement)**.

## Features

- 🏗 **Decorator-based Routing**: Define controllers and routes using concise decorators (`@Controller`, `@Get`, `@Post`).
- 👥 **Flexible User Management**: Pluggable `UserHandler` for custom Auth/Identity logic (JWT, Session, Database, etc.).
- 📜 **Auto-generated Swagger Docs**: Your API documentation is generated automatically from your code.
- ✅ **Request Validation**: Strict schema-based validation using AJV.
- 🔥 **Hot Module Replacement (HMR)**: Real-time frontend updates without full page reloads using Socket.io and hot script swapping.
- 🎨 **Frontend Serving**: Serve HTML/CSS/JS assets from memory, with built-in **Tailwind CSS** processing.
- 🐚 **Security Hardened**: Built-in protection with **Helmet**, **CORS**, **Rate Limiting**, and path traversal protection.
- 🖥 **Premium TUI Logs**: Clean, informative, and beautiful startup messages.

## Installation

```bash
bun add @synchjs/ewb
```

## Quick Start

### 1. Create a Controller

Create a file `controllers/HomeController.ts`:

```typescript
import { Controller, Get } from "@synchjs/ewb";

@Controller("/")
export class HomeController {
  @Get("/", {
    summary: "Welcome endpoint",
  })
  public index() {
    return { message: "Hello from @synchjs/ewb!" };
  }
}
```

### 2. Start the Server

Create `index.ts`:

```typescript
import { Server } from "@synchjs/ewb";

const server = new Server({
  id: "main",
  port: 3000,
  controllersDir: "controllers",
});

await server.init();
```

## Authentication & User Management

The framework uses a `UserHandler` system to give you full control over identity.

### 1. Define your User Handler

```typescript
import { UserHandler } from "@synchjs/ewb";
import type { Request, Response } from "express";

class MyUserHandler extends UserHandler {
  // Determine who the user is for every request
  public async authenticate(req: Request, res: Response) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token === "admin-secret") {
      return { id: 1, name: "Admin", roles: ["admin"] };
    }
    return null;
  }

  // Optional: Automatic routes for /auth/signin, signup, logout
  public signin(req: Request, res: Response) {
    /* ... */
  }
  public signup(req: Request, res: Response) {
    /* ... */
  }
  public logout(req: Request, res: Response) {
    /* ... */
  }
}
```

### 2. Protect Routes

Use `@Authorized` to require a user, or specify roles.

```typescript
import { Controller, Get, Authorized } from "@synchjs/ewb";

@Controller("/dashboard")
export class DashboardController {
  @Get("/profile")
  @Authorized() // Requires a non-null return from your UserHandler
  public getProfile({ user }: { user: any }) {
    return { message: `Hello ${user.name}` };
  }

  @Get("/admin")
  @Authorized(["admin"]) // Checks roles array from UserHandler
  public adminOnly() {
    return { message: "Admin area" };
  }
}
```

### 3. Register the Handler

```typescript
const server = new Server({ ... });
server.setUserHandler(new MyUserHandler()); // Routes /auth/* are created automatically
await server.init();
```

## Hot Module Replacement (HMR)

HMR is active by default when `NODE_ENV` is not set to `production`. It uses Socket.io to sync changes.

- **Fast Refresh**: Specifically optimized for React applications.
- **Hot Script Swapping**: Updates code in the browser without losing state or full page reloads.
- **Cache Control**: Automatically disables browser caching during development.

## Serving Frontend Assets

Use `@Serve` to bundle and serve frontend entry points.

```typescript
import { Controller, Get, Serve, Tailwindcss } from "@synchjs/ewb";

@Controller("/")
@Tailwindcss({ enable: true })
export class FrontendController {
  @Get("/")
  @Serve("views/src/index.html")
  public app() {
    // Handled by memory store
  }
}
```

## Security & Best Practices

- **Strict Validation**: AJV validates all request bodies defined in Swagger options. It automatically removes additional properties and enforces strict types.
- **Rate Limiting**: Protects your API from brute-force/DoS. (Static assets are automatically exempt).
- **Security Headers**: Powered by Helmet, with dynamic CSP adjustments for HMR.
- **Error Handling**: Production mode masks internal errors and stack traces.

## Server Configuration

| Option             | Type       | Description                                            |
| ------------------ | ---------- | ------------------------------------------------------ |
| `id`               | `string`   | ID for logging and console output.                     |
| `port`             | `number`   | Port to listen on.                                     |
| `controllersDir`   | `string`   | Location of your controllers (default: `controllers`). |
| `viewsDir`         | `string`   | Base directory for frontend views.                     |
| `enableSwagger`    | `boolean`  | Enable Swagger UI (default: `false`).                  |
| `swaggerPath`      | `string`   | Path for docs (default: `/api-docs`).                  |
| `helmetOptions`    | `object`   | Custom Helmet configuration.                           |
| `corsOptions`      | `object`   | Custom CORS configuration.                             |
| `rateLimitOptions` | `object`   | Custom Rate Limit configuration.                       |
| `roleHandler`      | `function` | Custom function for advanced role checking logic.      |

## License

MIT
