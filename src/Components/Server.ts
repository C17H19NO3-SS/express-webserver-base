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
import rateLimit from "express-rate-limit";
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
import { ServeMemoryStore } from "./ServeMemoryStore";
import boxen from "boxen";
import pc from "picocolors";

export class Server {
  private readonly _app: Express;
  private readonly _port: number;
  private readonly _controllersDir: string;
  public readonly _id: string;
  private readonly _enableSwagger: boolean;
  private readonly _enableLogging: boolean;
  private readonly _ajv: Ajv;
  private readonly _securityHandlers: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => void
  >;
  private readonly _container?: { get: (target: any) => any };
  private _serverInstance?: HttpServer;

  constructor(options: ServerOptions) {
    this._port = options.port;
    this._app = express();
    this._id = options.id;
    this._enableSwagger = options.enableSwagger || false;
    this._enableLogging =
      options.logging === undefined ? true : options.logging;
    this._controllersDir = options.controllersDir || "controllers";
    this._securityHandlers = options.securityHandlers || {};
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

    global.servers.set(this._id, this._app);
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
      this.printStartupMessage();
    });
  }

  private printStartupMessage() {
    const lines = [
      pc.green(`Server '${this._id}' is running!`),
      "",
      `${pc.bold("Port:")}       ${this._port}`,
      `${pc.bold("PID:")}        ${process.pid}`,
    ];

    if (this._enableSwagger) {
      lines.push(
        `${pc.bold("Swagger:")}    http://localhost:${this._port}/api-docs`,
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

        // 1. Auth Middleware (Old logic - support existing manual config)
        const methodSecurity = route.swagger?.security;
        const controllerSecurity = controller.security;
        // Combine security requirements
        const securityRequirements = [
          ...(methodSecurity || []),
          ...(controllerSecurity || []),
        ];

        if (securityRequirements.length > 0) {
          middlewares.push(this.createAuthMiddleware(securityRequirements));
        }

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
          },
        },
      },
      apis: [],
    };

    const specs = swaggerJsdoc(options);
    this._app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
  }
}

export interface ServerOptions {
  port: number;
  enableSwagger?: boolean;
  logging?: boolean;
  id: string;
  controllersDir?: string;
  corsOptions?: cors.CorsOptions;
  helmetOptions?: HelmetOptions;
  rateLimitOptions?: any;
  securityHandlers?: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => void
  >;
  container?: { get: (target: any) => any };
}
