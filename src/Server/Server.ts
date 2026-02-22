import type { Methods, ServerOptions } from "../types/Server";
import express, { type Express } from "express";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import boxen from "boxen";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import "reflect-metadata";
import { CONTROLLER_METADATA_KEY } from "../Decorations/Controller";
import { ROUTE_METADATA_KEY } from "../Decorations/Methods";
import { AUTHORIZE_METADATA_KEY } from "../Decorations/Authorize";
import { AUTH_REQUIRED_METADATA_KEY } from "../Decorations/AuthRequired";
import jwt from "jsonwebtoken";
import type { OpenAPIV3 } from "openapi-types";
import net from "node:net";
import readline from "node:readline/promises";

export class Server {
  public app: Express;
  public port: number;
  private options: ServerOptions;
  private controllerCount: number = 0;
  private routeCount: number = 0;
  private controllersPaths: string[] = [];
  private swaggerPaths: any = {};

  constructor(options?: ServerOptions | number) {
    if (typeof options === "number") {
      this.options = { port: options };
    } else {
      this.options = options || {};
    }

    this.app = express();
    this.port = this.options.port !== undefined ? this.options.port : 3000;

    const old = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const e = new Error();
    Error.captureStackTrace(e, Server);
    const callSites = e.stack as any;
    Error.prepareStackTrace = old;

    let callerDir = process.cwd();
    if (Array.isArray(callSites)) {
      for (const site of callSites) {
        const fileName = site.getFileName();
        if (
          fileName &&
          !fileName.includes("Server.ts") &&
          !fileName.includes("Server.js")
        ) {
          callerDir = path.dirname(fileName);
          break;
        }
      }
    }
    this.controllersPaths = [path.join(callerDir, "controllers")];

    if (this.options.cors !== undefined) this.setCors(this.options.cors);
    if (this.options.ratelimit !== undefined)
      this.setRateLimit(this.options.ratelimit);
    if (this.options.swagger !== undefined)
      this.setSwagger(this.options.swagger);
    if (this.options.controllers !== undefined)
      this.setControllers(this.options.controllers);
  }

  public setCors(config: ServerOptions["cors"] = true): this {
    this.options.cors = config;
    const corsOptions = typeof config === "boolean" || !config ? {} : config;
    if (config) this.app.use(cors(corsOptions));
    return this;
  }

  public setRateLimit(config: ServerOptions["ratelimit"] = true): this {
    this.options.ratelimit = config;
    const ratelimitOptions =
      typeof config === "boolean" || !config ? {} : config;
    if (config) this.app.use(rateLimit(ratelimitOptions));
    return this;
  }

  public setSwagger(config: ServerOptions["swagger"] = true): this {
    this.options.swagger = config;
    return this;
  }

  public setControllers(directories: string | string[]): this {
    this.controllersPaths = Array.isArray(directories)
      ? directories
      : [directories];
    return this;
  }

  private async loadControllers(directories: string[]) {
    for (const dir of directories) {
      const absolutePath = path.resolve(process.cwd(), dir);
      if (!fs.existsSync(absolutePath)) continue;

      const files = fs.readdirSync(absolutePath);
      for (const file of files) {
        if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

        const modulePath = path.join(absolutePath, file);
        const module = await import(modulePath);

        for (const key in module) {
          const ControllerClass = module[key];
          const prefixMetadata = Reflect.getMetadata(
            CONTROLLER_METADATA_KEY,
            ControllerClass,
          );

          if (prefixMetadata) {
            this.controllerCount++;
            const instance = new ControllerClass();
            const prototype = Object.getPrototypeOf(instance);
            const methods = Object.getOwnPropertyNames(prototype).filter(
              (m) => m !== "constructor",
            );

            methods.forEach((methodName) => {
              const route: {
                method: Methods;
                path: string;
                swaggerOptions?: Partial<OpenAPIV3.OperationObject>;
              } = Reflect.getMetadata(
                ROUTE_METADATA_KEY,
                prototype,
                methodName,
              );

              if (route) {
                this.routeCount++;
                const fullPath = (prefixMetadata.prefix + route.path).replace(
                  /\/\//g,
                  "/",
                );

                const middlewares: any[] = [];
                const authorizeMetadata =
                  Reflect.getMetadata(
                    AUTHORIZE_METADATA_KEY,
                    prototype,
                    methodName,
                  ) ||
                  Reflect.getMetadata(AUTHORIZE_METADATA_KEY, ControllerClass);

                const authRequiredMetadata =
                  Reflect.getMetadata(
                    AUTH_REQUIRED_METADATA_KEY,
                    prototype,
                    methodName,
                  ) ||
                  Reflect.getMetadata(
                    AUTH_REQUIRED_METADATA_KEY,
                    ControllerClass,
                  );

                if (authorizeMetadata || authRequiredMetadata) {
                  middlewares.push((req: any, res: any, next: any) => {
                    const authHeader = req.headers.authorization;
                    if (!authHeader || !authHeader.startsWith("Bearer ")) {
                      if (authRequiredMetadata) {
                        return res.status(401).json({ error: "Unauthorized" });
                      }
                      return next();
                    }
                    const token = authHeader.split(" ")[1];
                    const secret =
                      authorizeMetadata?.secret || process.env.JWT_SECRET;
                    if (!secret) {
                      return res
                        .status(500)
                        .json({ error: "JWT secret not configured" });
                    }
                    try {
                      req.user = jwt.verify(token, secret);
                      next();
                    } catch (err) {
                      if (authRequiredMetadata) {
                        return res.status(401).json({ error: "Invalid token" });
                      }
                      return next();
                    }
                  });
                }

                middlewares.push((req: any, res: any, next: any) => {
                  instance[methodName](req, res, next, req.user);
                });

                this.app[route.method](fullPath, ...middlewares);

                if (this.options.swagger) {
                  const swaggerPath = fullPath.replace(
                    /:([a-zA-Z0-9_]+)/g,
                    "{$1}",
                  );
                  if (!this.swaggerPaths[swaggerPath]) {
                    this.swaggerPaths[swaggerPath] = {};
                  }

                  const methodSwagger = route.swaggerOptions || {};

                  const defaultTags = [
                    ControllerClass.name.replace("Controller", ""),
                  ];
                  const tags =
                    methodSwagger.tags || prefixMetadata.tags || defaultTags;

                  const security =
                    authorizeMetadata || authRequiredMetadata
                      ? [{ bearerAuth: [] }]
                      : undefined;

                  this.swaggerPaths[swaggerPath][route.method] = {
                    tags,
                    ...(security ? { security } : {}),
                    ...methodSwagger,
                  };
                }
              }
            });
          }
        }
      }
    }
  }

  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.once("error", () => {
        resolve(false);
      });
      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });
    });
  }

  private async getAvailablePort(startingPort: number): Promise<number> {
    if (startingPort === 0) return 0;

    let currentPort = startingPort;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    while (true) {
      const isFree = await this.checkPort(currentPort);
      if (isFree) {
        rl.close();
        return currentPort;
      }

      const answer = await rl.question(
        chalk.yellow(
          `Port ${currentPort} is already in use. Would you like to use port ${currentPort + 1} instead? (Y/n) `,
        ),
      );

      if (answer.trim().toLowerCase() === "n") {
        rl.close();
        throw new Error(`Port ${startingPort} is required but already in use.`);
      } else {
        currentPort++;
      }
    }
  }

  public async init() {
    await this.loadControllers(this.controllersPaths);

    this.port = await this.getAvailablePort(this.port);

    if (this.options.swagger) {
      const userSwaggerOpts =
        typeof this.options.swagger === "boolean" ? {} : this.options.swagger;

      const defaultOptions = {
        openapi: "3.0.0",
        info: {
          title: "API Documentation",
          version: "1.0.0",
        },
        paths: this.swaggerPaths,
      };

      const swaggerOptions = {
        ...defaultOptions,
        ...userSwaggerOpts.options,
        info: {
          ...defaultOptions.info,
          ...(userSwaggerOpts.options?.info || {}),
        },
        paths: {
          ...this.swaggerPaths,
          ...(userSwaggerOpts.options?.paths || {}),
        },
        components: {
          ...(userSwaggerOpts.options?.components || {}),
          securitySchemes: {
            bearerAuth: {
              type: "http" as const,
              scheme: "bearer",
              bearerFormat: "JWT",
            },
            ...(userSwaggerOpts.options?.components?.securitySchemes || {}),
          },
        },
      };

      this.app.use(
        userSwaggerOpts.path || "/docs",
        swaggerUI.serve,
        swaggerUI.setup(swaggerOptions),
      );
    }

    const server = this.app.listen(this.port, () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null
          ? address.port
          : this.port;

      const { swagger, cors, ratelimit } = this.options;

      const getStatus = (enabled?: boolean) =>
        enabled ? chalk.green("Enabled") : chalk.red("Disabled");

      const lines = [
        chalk.green.bold(`Server is running on port ${actualPort}`),
        "",
        `${chalk.bold("Controllers:")} ${this.controllerCount}`,
        `${chalk.bold("Routes:")}      ${this.routeCount}`,
        "",
        `${chalk.bold("Swagger:")}   ${getStatus(!!swagger)}`,
        `${chalk.bold("CORS:")}      ${getStatus(!!cors)}`,
        `${chalk.bold("RateLimit:")} ${getStatus(!!ratelimit)}`,
      ];

      if (swagger) {
        const userSwaggerOpts = typeof swagger === "boolean" ? {} : swagger;
        lines.push("");
        lines.push(
          `${chalk.bold("Docs:")} http://localhost:${actualPort}${userSwaggerOpts.path || "/docs"}`,
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
    });
  }
}
