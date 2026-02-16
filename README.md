# ewb

A robust, decorator-based web server framework built on top of **Express** and optimized for **Bun**. It provides a structured way to build scalable APIs with built-in support for **OpenAPI (Swagger)**, **Validation**, **Authentication**, and **Frontend Asset Serving** (with Tailwind CSS support).

## Features

- 🏗 **Decorator-based Routing**: Define controllers and routes using concise decorators (`@Controller`, `@Get`, `@Post`).
- 🔒 **Built-in Authentication**: Easy-to-use Bearer Token authentication (`@BearerAuth`).
- 📜 **Auto-generated Swagger Docs**: Your API documentation is generated automatically from your code.
- ✅ **Request Validation**: Schema-based validation using AJV.
- 🎨 **Frontend Serving**: Serve HTML/CSS/JS assets from memory, with built-in **Tailwind CSS** processing via Bun plugins.
- 🧩 **Dependency Injection**: Support for IoC containers.
- 🚀 **Bun Optimized**: Leverages Bun's build capabilities for static assets.
- 🖥 **TUI-style Logs**: Clean and informative startup messages.

## Installation

```bash
bun add ewb
```

## Quick Start

### 1. Create a Controller

Create a file `controllers/HomeController.ts`:

```typescript
import { Controller, Get } from "ewb";
import type { Request, Response } from "express";

@Controller("/")
export class HomeController {
  @Get("/", {
    summary: "Welcome endpoint",
    description: "Returns a welcome message.",
  })
  public index(req: Request, res: Response) {
    return { message: "Hello from ewb!" };
  }
}
```

### 2. Start the Server

Create `index.ts`:

```typescript
import { Server } from "ewb";

const server = new Server({
  id: "main",
  port: 3000,
  controllersDir: "controllers", // Directory where your controllers are located
  enableSwagger: true, // Enable Swagger UI at /api-docs
});

server.init();
```

Run with Bun:

```bash
    bun run index.ts
```

### 3. Customize Swagger Path

You can change where Swagger UI is served:

````typescript
    const server = new Server({
      id: "main",
      port: 3000,
      enableSwagger: true,
      swaggerPath: "/docs", // Now available at http://localhost:3000/docs
    });
    ```

## Detailed Usage

### Controllers & Routing

Use `@Controller` to define a base path and HTTP method decorators for routes.

```typescript
import { Controller, Get, Post, Put, Delete } from "ewb";
import type { Request, Response } from "express";

@Controller("/users", { tags: ["Users"] })
export class UserController {
  @Get("/:id")
  public getUser(req: Request, res: Response) {
    const { id } = req.params;
    return { id, name: "User " + id };
  }

  @Post("/", {
    summary: "Create User",
    responses: {
      201: { description: "User created" },
    },
  })
  public createUser(req: Request, res: Response) {
    // Logic to create user
    return { id: 1, ...req.body };
  }
}
````

### Authentication

Secure your endpoints using `@BearerAuth`. It integrates with JWT verification automatically.

- **Class Level:** Protects all routes in the controller.
- **Method Level:** Protects specific routes.
- **@Public():** Excludes a route from class-level auth.

````typescript
import { Controller, Get, BearerAuth, Public } from "ewb";

@Controller("/secure")
@BearerAuth("my_secret_key") // Optional: Custom secret, defaults to process.env.JWT_SECRET
export class SecureController {
  @Get("/dashboard")
  public dashboard(req: Request, res: Response) {
    // Access user data attached by middleware (req.user)
    const user = (req as any).user;
    return { message: "Secret data", user };
  }

      @Get("/status")
      @Public() // Accessible without token
      public status(req: Request, res: Response) {
        return { status: "OK" };
      }
    }
    ```

    #### Advanced Security (@Security, @OAuth, @ApiKey)

    For other authentication methods like OAuth2 or API Keys, use generic decorators:

    ```typescript
    import { Controller, Get, OAuth, ApiKey } from "ewb";

    @Controller("/api")
    export class ApiController {
      @Get("/profile")
      @OAuth(["read:profile"]) // Marks route as requiring OAuth2 with specific scope
      public getProfile() {
        return { name: "John Doe" };
      }

      @Get("/data")
      @ApiKey("X-API-KEY") // Custom security scheme name
      public getData() {
        return { sensitive: "data" };
      }
    }
    ```

    **Configure Handlers and Schemes:**

    ```typescript
    const server = new Server({
      // ...,
      securitySchemes: {
        oauth2: {
          type: "oauth2",
          flows: { /* ... standard OpenAPI flow definition ... */ }
        }
      },
      securityHandlers: {
        oauth2: (req, res, next) => {
          // Your OAuth validation logic here
          next();
        }
      }
    });
    ```

### Request Validation

Define a JSON schema in the `@Post` (or other method) decorator to automatically validate the request body using AJV.

```typescript
@Post("/register", {
  summary: "Register new user",
  requestBody: {
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            username: { type: "string" },
            email: { type: "string", format: "email" },
            age: { type: "integer", minimum: 18 }
          },
          required: ["username", "email"]
        }
      }
    }
  }
})
public register(req: Request, res: Response) {
  // If execution reaches here, req.body is valid
  return { success: true };
}
````

### Serving Frontend Assets (with Tailwind CSS)

You can serve compiled HTML and automatically process Tailwind CSS using the `@Serve` and `@Tailwindcss` decorators.

1.  **Project Structure**:

    ```
    /views
      src/
        index.html
        index.css (imports tailwind, or handled via plugin)
        frontend.tsx
    ```

2.  **Controller Setup**:

````typescript
    @Controller("/")
    @Tailwindcss({
      enable: true,
      plugins: [ /* Bun plugins or custom PostCSS wrappers */ ]
    })
    export class FrontendController {
      @Get("/")
      @Serve("views/src/index.html") // Path to your HTML entry point
      public app(req: Request, res: Response) {
        // The decorator handles the response.
      }
    }
    ```

### Middleware

Apply custom Express middleware to controllers or routes using `@Middleware`.

```typescript
import { Controller, Get, Middleware } from "ewb";

const logAccess = (req: Request, res: Response, next: NextFunction) => {
  console.log("Accessed!");
  next();
};

@Controller("/audit")
@Middleware(logAccess)
export class AuditController {
  @Get("/")
  public index(req: Request, res: Response) {
    return { message: "Audited" };
  }
}
````

## Server Configuration

The `Server` class accepts the following options:

| Option             | Type            | Description                                                      |
| ------------------ | --------------- | ---------------------------------------------------------------- |
| `id`               | `string`        | Unique identifier for the server instance.                       |
| `port`             | `number`        | Port to listen on.                                               |
| `controllersDir`   | `string`        | Directory containing controller files.                           |
| `enableSwagger`    | `boolean`       | Enable OpenAPI documentation.                                    |
| `swaggerPath`      | `string`        | Custom path for Swagger UI (default: `/api-docs`).               |
| `logging`          | `boolean`       | Enable/disable TUI startup messages (default: true).             |
| `corsOptions`      | `CorsOptions`   | Configuration for CORS.                                          |
| `helmetOptions`    | `HelmetOptions` | Configuration for Helmet security headers.                       |
| `rateLimitOptions` | `any`           | Configuration for rate limiting.                                 |
| `securitySchemes`  | `object`        | custom OpenAPI security schemes definitions.                     |
| `securityHandlers` | `object`        | Middleware handlers for security schemes.                        |
| `container`        | `object`        | IoC container for dependency injection (must have `get` method). |

## License

MIT
