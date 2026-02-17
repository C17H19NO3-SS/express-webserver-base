import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc = require("swagger-jsdoc");
import helmet, { type HelmetOptions } from "helmet";
import cors from "cors";
import rateLimit, {
  type Options as RateLimitOptions,
} from "express-rate-limit";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { MetadataStorage } from "../Decorations";
import { Server as HttpServer, createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { UserHandler } from "./UserHandler";
import {
  PUBLIC_METADATA_KEY,
  ROLES_METADATA_KEY,
} from "../Decorations/Authorized";
import {
  SECURITY_METADATA_KEY,
  type SecurityRequirement,
} from "../Decorations/Security";
import {
  TAILWIND_METADATA_KEY,
  type TailwindOptions,
} from "../Decorations/Tailwind";
import { SERVE_HTML_METADATA_KEY } from "../Decorations/Serve";
import { ServeMemoryStore } from "./ServeMemoryStore";
import boxen from "boxen";
import pc from "picocolors";

export class Server {
  private readonly _app: Express;
  private readonly _port: number;
  private readonly _controllersDir: string;
  private readonly _viewsDir?: string;
  public readonly _id: string;
  private readonly _enableSwagger: boolean;
  private readonly _swaggerPath: string;
  private readonly _enableLogging: boolean;
  private readonly _securitySchemes?: any;
  private readonly _ajv: Ajv;
  private readonly _securityHandlers: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => void
  >;
  private readonly _container?: { get: (target: any) => any };
  private readonly _roleHandler?: (
    req: Request,
    roles: string[],
  ) => boolean | Promise<boolean>;
  private _userHandler?: UserHandler;
  private _serverInstance?: HttpServer;
  private _io?: SocketServer;
  // Stats
  private _controllerCount = 0;
  private _routeCount = 0;
  private _tailwindEnabled = false;
  private _devMode = false;

  constructor(options: ServerOptions) {
    this._port = options.port;
    this._app = express();
    this._id = options.id;
    this._enableSwagger = options.enableSwagger || false;
    this._swaggerPath = options.swaggerPath || "/api-docs";
    this._enableLogging =
      options.logging === undefined ? true : options.logging;
    this._controllersDir = options.controllersDir || "controllers";
    this._viewsDir = options.viewsDir;
    this._securityHandlers = options.securityHandlers || {};
    this._securitySchemes = options.securitySchemes;
    this._container = options.container;
    this._roleHandler = options.roleHandler;

    // Initialize AJV with strict mode for better security
    this._ajv = new Ajv({
      allErrors: true,
      strict: true,
      removeAdditional: true, // Automatically remove properties not in schema
    });
    addFormats(this._ajv);

    // Security Middleware
    const helmetOptions: any = options.helmetOptions || {};
    if (process.env.NODE_ENV !== "production") {
      // Relax CSP for HMR in development
      helmetOptions.contentSecurityPolicy = {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          frameSrc: ["'self'"],
        },
      };
    }
    this._app.use(helmet(helmetOptions));
    this._app.use(cors(options.corsOptions));
    this._app.use(
      rateLimit(
        options.rateLimitOptions || {
          windowMs: 15 * 60 * 1000,
          max: 100,
          skip: (req) =>
            ServeMemoryStore.instance.getAsset(req.path) !== undefined, // Don't rate limit static assets
        },
      ),
    );

    this._app.use(express.json({ limit: "1mb" })); // Protection against large payloads

    // Clear cache on startup
    ServeMemoryStore.instance.clearCache();

    this._devMode = process.env.NODE_ENV !== "production";
    if (this._devMode) {
      this.setupHmr();
    }

    global.servers.set(this._id, this._app);
  }

  private setupHmr() {
    ServeMemoryStore.instance.setDevMode(true);
    ServeMemoryStore.instance.onRebuild((data) => {
      if (data && data.html) {
        this._io?.emit("rebuild", { html: data.html });
      } else {
        this._io?.emit("reload");
      }
    });

    // No redundant global watcher here, we rely on ServeMemoryStore's specific watchers
    // which rebuild before notifying.
  }

  private log(message: string): void {
    if (this._enableLogging) {
      console.log(message);
    }
  }

  public async init(): Promise<void> {
    if (this._userHandler) {
      this.setupAuthRoutes();
    }
    await this.loadControllers();

    if (this._enableSwagger) {
      this.setupSwagger();
    }

    // Serve Static Assets from Memory Store
    this._app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();

      const asset = ServeMemoryStore.instance.getAsset(req.path);
      if (asset) {
        if (this._devMode) {
          res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          );
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
        res.type(asset.type).send(Buffer.from(asset.content));
        return;
      }
      next();
    });

    // Global Error Handler
    this._app.use(
      (err: any, req: Request, res: Response, next: NextFunction) => {
        const isProd = process.env.NODE_ENV === "production";
        if (!isProd) {
          console.error(`[${this._id}] Error:`, err);
        }

        res.status(err.status || 500).json({
          error: "Internal Server Error",
          message: isProd
            ? "An unexpected error occurred"
            : err.message || "An unexpected error occurred",
          // Mask stack trace in production
          stack: isProd ? undefined : err.stack,
        });
      },
    );

    this._serverInstance = createServer(this._app);

    if (this._devMode) {
      this._io = new SocketServer(this._serverInstance, {
        cors: {
          origin: [/localhost/, /127\.0\.0\.1/], // Restrict HMR to local development origin
        },
      });
      this._io.on("connection", (socket) => {
        // Disconnected client log
      });
    }

    this._serverInstance.listen(this._port, () => {
      if (this._enableLogging) {
        this.printStartupMessage();
      }
    });
  }

  private printStartupMessage() {
    const pad = (str: string) => str.padEnd(15);

    const lines = [
      pc.green(`Server '${this._id}' is running!`),
      "",
      `${pc.bold(pad("Port:"))}${this._port}`,
      `${pc.bold(pad("PID:"))}${process.pid}`,
      `${pc.bold(pad("Controllers:"))}${this._controllerCount}`,
      `${pc.bold(pad("Routes:"))}${this._routeCount}`,
      `${pc.bold(pad("Tailwind:"))}${
        this._tailwindEnabled ? pc.blue("Enabled") : pc.dim("Disabled")
      }`,
      `${pc.bold(pad("HMR:"))}${
        this._devMode ? pc.cyan("Active") : pc.dim("Inactive")
      }`,
    ];

    if (this._viewsDir) {
      lines.push(`${pc.bold(pad("Views:"))}${this._viewsDir}`);
    }

    if (this._enableSwagger) {
      lines.push(
        `${pc.bold(pad("Swagger:"))}http://localhost:${this._port}${
          this._swaggerPath
        }`,
      );
    }

    console.log(
      boxen(lines.join("\n"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "green",
        title: "Server Status",
        titleAlignment: "center",
      }),
    );
  }

  public close(): void {
    if (this._serverInstance) {
      this._serverInstance.close(() => {
        this.log(`Server '${this._id}' stopped.`);
      });
    }
    global.servers.delete(this._id);
  }

  public setUserHandler(handler: UserHandler): void {
    this._userHandler = handler;
  }

  private setupAuthRoutes(): void {
    if (!this._userHandler) return;

    this._app.post("/auth/signin", async (req, res, next) => {
      try {
        const result = await this._userHandler!.signin(req, res);
        res.json(result);
      } catch (err) {
        next(err);
      }
    });

    this._app.post("/auth/signup", async (req, res, next) => {
      try {
        const result = await this._userHandler!.signup(req, res);
        res.json(result);
      } catch (err) {
        next(err);
      }
    });

    this._app.post("/auth/logout", async (req, res, next) => {
      try {
        const result = await this._userHandler!.logout(req, res);
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  }

  private async loadControllers(): Promise<void> {
    const absoluteControllersPath = path.resolve(
      process.cwd(),
      this._controllersDir,
    );

    if (!fs.existsSync(absoluteControllersPath)) {
      console.warn(
        `Controllers directory not found: ${absoluteControllersPath}`,
      );
      return;
    }

    const files = fs
      .readdirSync(absoluteControllersPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

    for (const file of files) {
      const filePath = path.join(absoluteControllersPath, file);
      await import(filePath);
    }

    const controllers = MetadataStorage.instance.getControllers();

    for (const controller of controllers) {
      if (controller.serverIds && !controller.serverIds.includes(this._id)) {
        continue;
      }

      this._controllerCount++;

      // Check for Tailwind metadata
      const tailwindOptions: TailwindOptions | undefined = Reflect.getMetadata(
        TAILWIND_METADATA_KEY,
        controller.target,
      );
      if (tailwindOptions?.enable) {
        this._tailwindEnabled = true;
      }

      const instance = this._container?.get
        ? this._container.get(controller.target)
        : new controller.target();

      for (const route of controller.routes) {
        const fullPath = (controller.path + "/" + route.path).replace(
          /\/+/g,
          "/",
        );
        const middlewares: Array<
          (req: Request, res: Response, next: NextFunction) => void
        > = [];

        // Check ROLES metadata
        const classRoles: string[] | undefined = Reflect.getMetadata(
          ROLES_METADATA_KEY,
          controller.target,
        );
        const methodRoles: string[] | undefined = Reflect.getMetadata(
          ROLES_METADATA_KEY,
          controller.target.prototype,
          route.handlerName,
        );

        const requiredRoles = methodRoles || classRoles;

        const isPublic = Reflect.getMetadata(
          PUBLIC_METADATA_KEY,
          controller.target.prototype,
          route.handlerName,
        );

        // 1. Auth & Role Middlewares
        if (!isPublic) {
          // If not public, we always run the role check (which might include authentication via UserHandler)
          middlewares.push(this.createRoleMiddleware(requiredRoles || []));

          // Inject Swagger security definition automatically
          if (!route.swagger) {
            route.swagger = {
              responses: {
                200: {
                  description: "Default response",
                },
              },
            };
          }

          if (!route.swagger.security) {
            route.swagger.security = [];
          }

          // specific check to avoid duplicating if user manually added it
          const hasBearer = route.swagger.security.some(
            (s) => "bearerAuth" in s,
          );
          if (!hasBearer) {
            route.swagger.security.push({ bearerAuth: [] });
          }
        }

        // 1.1 Role Middlewares - now handled above for non-public routes

        // 2. Generic Security Middleware (@Security, @ApiKey, etc)
        const classGenericSecurity: SecurityRequirement[] =
          Reflect.getMetadata(SECURITY_METADATA_KEY, controller.target) || [];
        const methodGenericSecurity: SecurityRequirement[] =
          Reflect.getMetadata(
            SECURITY_METADATA_KEY,
            controller.target.prototype,
            route.handlerName,
          ) || [];

        let genericRequirements: SecurityRequirement[] = [];

        if (isPublic) {
          // If public, we might want to skip class generic security too?
          // Usually yes.
          genericRequirements = [...methodGenericSecurity];
        } else {
          genericRequirements = [
            ...classGenericSecurity,
            ...methodGenericSecurity,
          ];
        }

        // Add to Swagger
        if (genericRequirements.length > 0) {
          if (!route.swagger) {
            route.swagger = {
              responses: {
                200: { description: "Default response" },
              },
            };
          }
          if (!route.swagger.security) {
            route.swagger.security = [];
          }
          route.swagger.security.push(...genericRequirements);
        }

        // 3. Auth Middleware (Old logic - support existing manual config + generic)
        const manualRequirements = [
          ...(route.swagger?.security || []),
          ...(controller.security || []),
        ];

        // We already pushed genericRequirements to route.swagger.security, so manualRequirements includes them?
        // Wait, route.swagger.security is updated above.
        // So manualRequirements now has everything including bearerAuth (pushed above) and generic (pushed above).
        // BUT, controller.security (from @Controller options) might duplicate classGenericSecurity?
        // Let's rely on route.swagger.security + controller.security.
        // And we should filter out duplicates if necessary, but Swagger UI handles it usually (OR logic between items in array).
        // Actually, genericRequirements are added to route.swagger.security.
        // So we can just use route.swagger.security.
        // However, controller.security is separate.

        const allSecurityRequirements = [
          ...(route.swagger?.security || []),
          ...(controller.security || []),
        ];

        // Filter out bearerAuth if handled by createJwtMiddleware (to avoid double check if handler is missing)
        // createJwtMiddleware handles 'bearerAuth'.
        // createAuthMiddleware handles everything else via securityHandlers.
        // If we have 'bearerAuth' in requirements, createAuthMiddleware will look for a handler for 'bearerAuth'.
        // If user didn't provide one, it warns.
        // We should probably allow 'bearerAuth' in createAuthMiddleware IF user provided a handler.
        // But we added createJwtMiddleware explicitly.
        // So we should filter 'bearerAuth' out of requirements passed to createAuthMiddleware UNLESS user provided a handler for it?
        // Or just let it run. If user provides handler, it runs twice?
        // createJwtMiddleware is added if `authSecret` is true (from @BearerAuth).
        // If `bearerAuth` is in swagger because of @BearerAuth, we risk running twice if user adds handler.
        // But `@BearerAuth` logic uses `createJwtMiddleware`.
        // The `genericRequirements` logic adds to swagger.
        // Let's assume standard usage: use @BearerAuth OR @Security("bearerAuth"). Not both.

        if (allSecurityRequirements.length > 0) {
          middlewares.push(this.createAuthMiddleware(allSecurityRequirements));
        }

        // 4. Validation Middleware

        // 2. Validation Middleware
        if (
          route.swagger?.requestBody &&
          (route.swagger.requestBody as any).content?.["application/json"]
            ?.schema
        ) {
          const schema = (route.swagger.requestBody as any).content[
            "application/json"
          ].schema;
          middlewares.push(this.createValidationMiddleware(schema));
        }

        // 3. Custom Middlewares
        // Controller Level
        if (controller.middlewares) {
          middlewares.push(...controller.middlewares);
        }
        // Route Level
        if (route.middlewares) {
          middlewares.push(...route.middlewares);
        }

        // 3. Route Handler
        const handler = async (
          req: Request,
          res: Response,
          next: NextFunction,
        ) => {
          try {
            const user = this._userHandler
              ? await this._userHandler.authenticate(req, res)
              : (req as any).user;

            const result = instance[route.handlerName]({
              req,
              res,
              user,
              next,
            });

            const handleResult = (val: any) => {
              if (val !== undefined && !res.headersSent) {
                if (typeof val === "string") {
                  res.send(val);
                } else if (typeof val === "object") {
                  res.json(val);
                }
              }
            };

            if (result instanceof Promise) {
              result.then(handleResult).catch(next);
            } else {
              handleResult(result);
            }
          } catch (error) {
            next(error);
          }
        };

        (this._app as any)[route.method](fullPath, ...middlewares, handler);
        this._routeCount++;

        // Pre-build if @Serve is used
        const htmlPath = Reflect.getMetadata(
          SERVE_HTML_METADATA_KEY,
          controller.target.prototype,
          route.handlerName,
        );
        if (htmlPath) {
          // Silent pre-build
          await ServeMemoryStore.instance.buildAndCache(
            htmlPath,
            tailwindOptions,
          );
        }
      }
    }
  }

  private createRoleMiddleware(roles: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = this._userHandler
        ? await this._userHandler.authenticate(req, res)
        : (req as any).user;

      if (!user) {
        return res.status(401).json({ error: "Unauthorized: No user found" });
      }

      // If no specific roles required, but it's not public, just authentication is enough
      if (roles.length === 0) {
        return next();
      }

      if (!this._roleHandler) {
        // Default role check behavior
        const userRoles = Array.isArray(user.roles)
          ? user.roles
          : user.role
            ? [user.role]
            : [];

        const hasRole = roles.some((role) => userRoles.includes(role));
        if (!hasRole) {
          return res.status(403).json({
            error: "Forbidden: You do not have the required permissions",
          });
        }
        return next();
      }

      try {
        const result = await this._roleHandler(req, roles);
        if (result) {
          // Assuming 'result' is a boolean indicating success
          next();
        } else {
          // The provided snippet seems to be for serving HTML, which is out of context for a role middleware.
          // Applying the original logic for role failure.
          res.status(403).json({
            error: "Forbidden: You do not have the required permissions",
          });
        }
      } catch (err) {
        next(err);
      }
    };
  }

  private createAuthMiddleware(requirements: any[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (requirements.length === 0) return next();

      let requirementIndex = 0;

      const checkRequirement = (index: number) => {
        if (index >= requirements.length) {
          // All requirements failed
          return res.status(401).json({ error: "Unauthorized" });
        }

        const requirement = requirements[index];
        const schemes = Object.keys(requirement);

        if (schemes.length === 0) {
          // Empty requirement means public access is allowed
          return next();
        }

        const checkScheme = (schemeIndex: number) => {
          if (schemeIndex >= schemes.length) {
            // All schemes in this requirement passed
            return next();
          }

          const scheme = schemes[schemeIndex]!;
          const handler = this._securityHandlers[scheme];

          if (!handler) {
            console.warn(
              `[${this._id}] Security handler for '${scheme}' not configured.`,
            );
            // If handler is missing, this scheme fails. Ideally, we should treat it as an error.
            // But since this is one of potentially many AND schemes, failure here means this requirement fails.
            // Move to next requirement.
            return checkRequirement(index + 1);
          }

          handler(req, res, (err?: any) => {
            if (err) {
              // This scheme failed, so the whole requirement fails.
              // Move to the next requirement (OR logic).
              return checkRequirement(index + 1);
            }
            // This scheme passed, move to the next scheme in the same requirement (AND logic).
            checkScheme(schemeIndex + 1);
          });
        };

        checkScheme(0);
      };

      checkRequirement(0);
    };
  }

  private createValidationMiddleware(schema: any) {
    const validate = this._ajv.compile(schema);
    return (req: Request, res: Response, next: NextFunction) => {
      const valid = validate(req.body);
      if (!valid) {
        return res.status(400).json({
          error: "Validation Error",
          details: validate.errors,
        });
      }
      next();
    };
  }

  private setupSwagger(): void {
    const controllers = MetadataStorage.instance
      .getControllers()
      .filter((c) => !c.serverIds || c.serverIds.includes(this._id));

    const paths: any = {};

    for (const controller of controllers) {
      for (const route of controller.routes) {
        const fullPath = (controller.path + "/" + route.path)
          .replace(/\/+/g, "/")
          .replace(/:([^/]+)/g, "{$1}");

        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        const operation = route.swagger
          ? { ...route.swagger }
          : {
              responses: {
                200: {
                  description: "Default response",
                },
              },
            };

        if (controller.tags) {
          operation.tags = [...(operation.tags || []), ...controller.tags];
        }

        if (controller.security) {
          operation.security = [
            ...(operation.security || []),
            ...controller.security,
          ];
        }

        paths[fullPath][route.method] = operation;
      }
    }

    const options = {
      definition: {
        openapi: "3.0.0",
        info: {
          title: `Server ${this._id} API`,
          version: "1.0.0",
        },
        paths: paths,
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
            ...this._securitySchemes,
          },
        },
      },
      apis: [],
    };

    const specs = swaggerJsdoc(options);
    this._app.use(this._swaggerPath, swaggerUi.serve, swaggerUi.setup(specs));
  }
}

export interface ServerOptions {
  port: number;
  enableSwagger?: boolean;
  swaggerPath?: string;
  logging?: boolean;
  id: string;
  controllersDir?: string;
  viewsDir?: string;
  corsOptions?: cors.CorsOptions;
  helmetOptions?: HelmetOptions;
  rateLimitOptions?: Partial<RateLimitOptions>;
  securityHandlers?: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => void
  >;
  securitySchemes?: Record<string, any>;
  container?: { get: (target: any) => any };
  roleHandler?: (req: Request, roles: string[]) => boolean | Promise<boolean>;
}
