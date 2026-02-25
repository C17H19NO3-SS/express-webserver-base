import type {
  Methods,
  ServerOptions,
  CorsConfig,
  RateLimitConfig,
  SwaggerConfig,
  ViewsConfig,
} from "../types/Server";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
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
import http from "node:http";
import readline from "node:readline/promises";
import { Server as SocketIOServer } from "socket.io";

/**
 * Express Web Server Base (EWB)
 * A powerful, decorator-driven wrapper around Express.js featuring integrated Swagger, CORS, Rate Limit, and native Bun.build view engines.
 */
export class Server {
  public app: Express;
  public port: number;
  public httpServer: http.Server;
  public io?: SocketIOServer;
  private options: ServerOptions;
  private controllerCount: number = 0;
  private routeCount: number = 0;
  private controllersPaths: string[] = [];
  private swaggerPaths: Record<string, any> = {};
  private hasAuthRoutes: boolean = false;

  /**
   * Initializes a new Server instance.
   * @param options Port number or a complete ServerOptions configuration object.
   */
  constructor(options?: ServerOptions | number) {
    if (typeof options === "number") {
      this.options = { port: options };
    } else {
      this.options = options || {};
    }

    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.port = this.options.port !== undefined ? this.options.port : 3000;

    if (this.options.socketio) {
      const ioOpts =
        typeof this.options.socketio === "object" ? this.options.socketio : {};
      this.io = new SocketIOServer(this.httpServer, ioOpts);
    }

    const old = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const e = new Error();
    Error.captureStackTrace(e, Server);
    const callSites = e.stack as NodeJS.CallSite[] | undefined;
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
    if (this.options.controllers !== undefined) {
      if (Array.isArray(this.options.controllers)) {
        this.setControllers(...this.options.controllers);
      } else {
        this.setControllers(this.options.controllers);
      }
    }
    if (this.options.views !== undefined) this.setViews(this.options.views);
    if (this.options.plugins !== undefined)
      this.setViewPlugins(...this.options.plugins);
  }

  /**
   * Configures Cross-Origin Resource Sharing (CORS).
   * @param config A boolean to enable defaults or an Express cors configuration object.
   * @returns The Server instance for method chaining.
   */
  public setCors(config: CorsConfig = true): this {
    this.options.cors = config;
    if (config) {
      const corsOptions = typeof config === "boolean" ? {} : config;
      this.app.use(cors(corsOptions));
    }
    return this;
  }

  /**
   * Configures express rate limiting to prevent abuse and brute-force attacks.
   * @param config A boolean to enable defaults or a partial express-rate-limit configuration object.
   * @returns The Server instance for method chaining.
   */
  public setRateLimit(config: RateLimitConfig = true): this {
    this.options.ratelimit = config;
    if (config) {
      const ratelimitOptions = typeof config === "boolean" ? {} : config;
      this.app.use(rateLimit(ratelimitOptions));
    }
    return this;
  }

  /**
   * Integrates Bun plugins into the native view engine compiler.
   * Ideal for tailwindcss, SCSS, SVG, or other asset processing utilities.
   * @param plugins Active Bun plugins to register (e.g., `tailwindcssPlugin, scssPlugin`).
   * @returns The Server instance for method chaining.
   */
  public setViewPlugins(
    ...plugins: NonNullable<ServerOptions["plugins"]>
  ): this {
    this.options.plugins = plugins;
    return this;
  }

  /**
   * Sets up a high-performance, live-compiling View Engine natively powered by `Bun.build`.
   * When `res.render()` is called on HTML endpoints, it automatically bundles TS/React components.
   * @param config Boolean or a Views option object specifying directory and cache paths.
   * @returns The Server instance for method chaining.
   */
  public setViews(config: ViewsConfig = true): this {
    this.options.views = config;
    if (config) {
      const viewsOptions = typeof config === "boolean" ? {} : config;
      const dir = viewsOptions.dir || path.join(process.cwd(), "views");
      const publicPath = viewsOptions.publicPath || "/_assets/";
      const cacheDir =
        viewsOptions.cacheDir || path.join(process.cwd(), ".ebw-build");

      const hmrEnabled =
        viewsOptions.hmr !== undefined
          ? viewsOptions.hmr
          : process.env.NODE_ENV !== "production";

      this.app.set("views", dir);
      this.app.set("view engine", "html");
      this.app.use(publicPath, express.static(cacheDir));

      if (hmrEnabled) {
        if (!this.io) {
          const ioOpts =
            typeof this.options.socketio === "object"
              ? this.options.socketio
              : {};
          this.io = new SocketIOServer(this.httpServer, ioOpts);
        }

        if (fs.existsSync(dir)) {
          let timeout: NodeJS.Timeout | null = null;
          fs.watch(dir, { recursive: true }, (eventType, filename) => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
              this.io?.emit("hmr:reload");
            }, 100);
          });
        }
      }

      this.app.engine(
        "html",
        async (filePath: string, options: any, callback: any) => {
          try {
            if (fs.existsSync(cacheDir)) {
              await fs.promises.rm(cacheDir, { recursive: true, force: true });
            }

            // @ts-ignore
            const buildResult = await Bun.build({
              entrypoints: [filePath],
              outdir: cacheDir,
              publicPath: publicPath,
              target: "browser",
              format: "esm",
              minify: process.env.NODE_ENV === "production",
              plugins: this.options.plugins || [],
            });

            if (!buildResult.success) {
              const errors = buildResult.logs
                .map((l: any) => l.message)
                .join("\\n");
              return callback(new Error(`Bun.build failed:\\n${errors}`));
            }

            const htmlOutput = buildResult.outputs.find(
              (o: any) => o.kind === "entry-point" && o.path.endsWith(".html"),
            );
            if (!htmlOutput) {
              return callback(
                new Error("HTML output not found from Bun.build"),
              );
            }

            let htmlText = await htmlOutput.text();

            if (hmrEnabled) {
              const hmrScript = `
                <script src="/socket.io/socket.io.js"></script>
                <script>
                  if (typeof window !== "undefined" && window.io) {
                    const socket = window.io();
                    socket.on("connect", () => console.log("[EWB] HMR connected via Socket.IO"));
                    socket.on("disconnect", () => console.log("[EWB] HMR disconnected"));
                    socket.on("hmr:reload", async () => {
                      console.log("[EWB] Change detected, fetching updates...");
                      try {
                        const currentUrl = new URL(window.location.href);
                        currentUrl.searchParams.set("_hmr", Date.now().toString());
                        const res = await fetch(currentUrl.toString());
                        if (!res.ok) throw new Error("Fetch failed");
                        const html = await res.text();
                        const parser = new DOMParser();
                        const newDoc = parser.parseFromString(html, "text/html");
                        
                        const newStyles = Array.from(newDoc.querySelectorAll("link[rel='stylesheet'], style"));
                        const oldStyles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"));
                        oldStyles.forEach((s) => s.remove());
                        newStyles.forEach((s) => {
                          if (s.tagName === "LINK") {
                            const href = s.getAttribute("href");
                            if (href) s.setAttribute("href", href + (href.includes("?") ? "&" : "?") + "_hmr=" + Date.now());
                          }
                          document.head.appendChild(s.cloneNode(true));
                        });
                        
                        document.body.innerHTML = newDoc.body.innerHTML;
                        const scripts = Array.from(document.body.querySelectorAll("script"));
                        for (const oldScript of scripts) {
                          if (oldScript.src && oldScript.src.includes("/socket.io/")) continue;
                          if (oldScript.innerHTML.includes("[EWB] HMR connected")) continue;
                          const newScript = document.createElement("script");
                          Array.from(oldScript.attributes).forEach((attr) => {
                            if (attr.name === "src") {
                               newScript.setAttribute(attr.name, attr.value + (attr.value.includes("?") ? "&" : "?") + "_hmr=" + Date.now());
                            } else {
                               newScript.setAttribute(attr.name, attr.value);
                            }
                          });
                          newScript.text = oldScript.text;
                          if (oldScript.parentNode) {
                            oldScript.parentNode.replaceChild(newScript, oldScript);
                          }
                        }
                      } catch (err) {
                        console.error("[EWB] HMR Update failed, falling back to full context reload", err);
                        window.location.reload();
                      }
                    });
                  }
                </script>
              `;
              if (htmlText.includes("</body>")) {
                htmlText = htmlText.replace(
                  "</body>",
                  `${hmrScript}\\n</body>`,
                );
              } else {
                htmlText += hmrScript;
              }
            }

            callback(null, htmlText);
          } catch (err) {
            callback(err);
          }
        },
      );
    }
    return this;
  }

  /**
   * Turns on automatic Swagger/OpenAPI documentation generation.
   * Scans controllers for route parameters, endpoints, and Authorization requirements.
   * @param config Boolean to use defaults, or detailed Swagger configuration.
   * @returns The Server instance for method chaining.
   */
  public setSwagger(config: SwaggerConfig = true): this {
    this.options.swagger = config;
    return this;
  }

  /**
   * Explicitly sets one or multiple paths to load Controller classes from.
   * Defaults to `"./controllers"` relative to where the Server was constructed.
   * @param directories One or multiple directory paths to load controllers from.
   * @returns The Server instance for method chaining.
   */
  public setControllers(...directories: (string | string[])[]): this {
    this.controllersPaths = directories.flat() as string[];
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

                const middlewares: RequestHandler[] = [];
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
                  this.hasAuthRoutes = true;
                  middlewares.push(
                    (req: Request, res: Response, next: NextFunction) => {
                      const authHeader = req.headers.authorization;
                      if (!authHeader || !authHeader.startsWith("Bearer ")) {
                        if (authRequiredMetadata) {
                          res.status(401).json({ error: "Unauthorized" });
                          return;
                        }
                        return next();
                      }
                      const token = authHeader.split(" ")[1];
                      const secret =
                        authorizeMetadata?.secret || process.env.JWT_SECRET;
                      if (!secret) {
                        res
                          .status(500)
                          .json({ error: "JWT secret not configured" });
                        return;
                      }
                      try {
                        (req as any).user = jwt.verify(token!, secret);
                        next();
                      } catch (err) {
                        if (authRequiredMetadata) {
                          res.status(401).json({ error: "Invalid token" });
                          return;
                        }
                        return next();
                      }
                    },
                  );
                }

                middlewares.push(
                  (req: Request, res: Response, next: NextFunction) => {
                    instance[methodName](req, res, next, (req as any).user);
                  },
                );

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

  /**
   * Finalizes configuration and boots up the web server.
   * It loads all designated controllers, attempts port binding, mounts endpoints, builds swagger, and launches the listener.
   */
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
          ...(this.hasAuthRoutes
            ? {
                securitySchemes: {
                  bearerAuth: {
                    type: "http" as const,
                    scheme: "bearer",
                    bearerFormat: "JWT",
                  },
                  ...(userSwaggerOpts.options?.components?.securitySchemes ||
                    {}),
                },
              }
            : {}),
        },
      };

      this.app.use(
        userSwaggerOpts.path || "/docs",
        swaggerUI.serve,
        swaggerUI.setup(swaggerOptions),
      );
    }

    const server = this.httpServer.listen(this.port, () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null
          ? address.port
          : this.port;

      const { swagger, cors, ratelimit, views } = this.options;

      const getStatus = (enabled?: boolean | object) =>
        enabled ? chalk.green("Enabled") : chalk.red("Disabled");

      const lines = [
        chalk.green.bold(`Server is running on port ${actualPort}`),
        "",
        `${chalk.bold("Controllers:")} ${this.controllerCount}`,
        `${chalk.bold("Routes:")}      ${this.routeCount}`,
        "",
        `${chalk.bold("Swagger:")}   ${getStatus(swagger)}`,
        `${chalk.bold("CORS:")}      ${getStatus(cors)}`,
        `${chalk.bold("RateLimit:")} ${getStatus(ratelimit)}`,
        `${chalk.bold("Views:")}     ${getStatus(views)}`,
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
