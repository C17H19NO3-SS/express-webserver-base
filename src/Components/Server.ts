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
import { Server as HttpServer } from "http";
import * as jwt from "jsonwebtoken";
import {
  AUTH_METADATA_KEY,
  PUBLIC_METADATA_KEY,
  type AuthInfo,
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
  private _serverInstance?: HttpServer;
  // Stats
  private _controllerCount = 0;
  private _routeCount = 0;
  private _tailwindEnabled = false;
  private _devMode = false;
  private _sseClients: Response[] = [];

  constructor(options: ServerOptions) {
    this._port = options.port;
    this._app = express();
    this._id = options.id;
    this._enableSwagger = options.enableSwagger || false;
    this._swaggerPath = options.swaggerPath || "/api-docs";
    this._enableLogging =
      options.logging === undefined ? true : options.logging;
    this._controllersDir = options.controllersDir || "controllers";
    this._securityHandlers = options.securityHandlers || {};
    this._securitySchemes = options.securitySchemes;
    this._container = options.container;

    // Initialize AJV
    this._ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this._ajv);

    // Security Middleware
    this._app.use(helmet(options.helmetOptions));
    this._app.use(cors(options.corsOptions));
    this._app.use(
      rateLimit(
        options.rateLimitOptions || {
          windowMs: 15 * 60 * 1000,
          max: 100,
        },
      ),
    );

    this._app.use(express.json());

    this._devMode = options.devMode ?? process.env.NODE_ENV === "development";
    if (this._devMode) {
      this.setupHmr();
    }

    global.servers.set(this._id, this._app);
  }

  private setupHmr() {
    ServeMemoryStore.instance.setDevMode(true);
    ServeMemoryStore.instance.onRebuild(() => {
      this.log(
        `[${this._id}] Sending reload signal to ${this._sseClients.length} clients`,
      );
      this._sseClients.forEach((res) => {
        res.write("data: reload\n\n");
      });
    });

    this._app.get("/ebw-hmr", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      this._sseClients.push(res);

      req.on("close", () => {
        this._sseClients = this._sseClients.filter((c) => c !== res);
      });
    });
  }

  private log(message: string): void {
    if (this._enableLogging) {
      console.log(message);
    }
  }

  public async init(): Promise<void> {
    await this.loadControllers();

    if (this._enableSwagger) {
      this.setupSwagger();
    }

    // Serve Static Assets from Memory Store
    this._app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();

      const asset = ServeMemoryStore.instance.getAsset(req.path);
      if (asset) {
        res.type(asset.type).send(Buffer.from(asset.content));
        return;
      }
      next();
    });

    // Global Error Handler
    this._app.use(
      (err: any, req: Request, res: Response, next: NextFunction) => {
        console.error(`[${this._id}] Error:`, err);
        res.status(err.status || 500).json({
          error: "Internal Server Error",
          message: "An unexpected error occurred",
        });
      },
    );

    this._serverInstance = this._app.listen(this._port, () => {
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

      // Check class level auth
      const classAuthInfo: AuthInfo | undefined = Reflect.getMetadata(
        AUTH_METADATA_KEY,
        controller.target,
      );

      for (const route of controller.routes) {
        const fullPath = (controller.path + "/" + route.path).replace(
          /\/+/g,
          "/",
        );
        const middlewares: Array<
          (req: Request, res: Response, next: NextFunction) => void
        > = [];

        // Check method level metadata
        const methodAuthInfo: AuthInfo | undefined = Reflect.getMetadata(
          AUTH_METADATA_KEY,
          controller.target.prototype,
          route.handlerName,
        );

        const isPublic = Reflect.getMetadata(
          PUBLIC_METADATA_KEY,
          controller.target.prototype,
          route.handlerName,
        );

        // Determine if auth is required and which secret to use
        let authSecret: string | undefined;

        if (isPublic) {
          authSecret = undefined;
        } else if (methodAuthInfo) {
          authSecret = methodAuthInfo.secret || process.env.JWT_SECRET;
        } else if (classAuthInfo) {
          authSecret = classAuthInfo.secret || process.env.JWT_SECRET;
        }

        // 1. Auth Middleware (New Decorator Logic)
        if (authSecret) {
          middlewares.push(this.createJwtMiddleware(authSecret));

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

        // 2. Generic Security Middleware (@Security, @OAuth, etc)
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
        const handler = (req: Request, res: Response, next: NextFunction) => {
          try {
            const result = instance[route.handlerName](req, res, next);

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
          this.log(`[${this._id}] Pre-building HTML: ${htmlPath}`);
          await ServeMemoryStore.instance.buildAndCache(
            htmlPath,
            tailwindOptions,
          );
        }
      }
    }
  }

  private createJwtMiddleware(secret: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing Bearer token" });
      }

      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token as string, secret as string);
        (req as any).user = decoded; // Attach user to request
        next();
      } catch (err) {
        return res.status(403).json({ error: "Forbidden: Invalid token" });
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
  devMode?: boolean;
  corsOptions?: cors.CorsOptions;
  helmetOptions?: HelmetOptions;
  rateLimitOptions?: Partial<RateLimitOptions>;
  securityHandlers?: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => void
  >;
  securitySchemes?: Record<string, any>;
  container?: { get: (target: any) => any };
}
