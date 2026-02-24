import type { CorsOptions } from "cors";
import type { Options } from "express-rate-limit";
import type { OpenAPIV3 } from "openapi-types";
import type { BunPlugin } from "bun";

/**
 * Configuration options for Swagger/OpenAPI documentation generation.
 * Can be a boolean to enable/disable with defaults, or an object with specific options.
 */
export type SwaggerConfig =
  | boolean
  | {
      path?: string;
      options?: Omit<Partial<OpenAPIV3.Document>, "paths"> & { paths?: any };
    };

/**
 * Configuration for Express Rate Limiter.
 * Prevents brute-force attacks and limits repeated requests.
 */
export type RateLimitConfig = boolean | Partial<Options>;

/**
 * Configuration for CORS (Cross-Origin Resource Sharing).
 * Controls which domains can access your API.
 */
export type CorsConfig = boolean | CorsOptions;

/**
 * Configuration for Express View Engine natively powered by Bun.build.
 * Compiles TS/React/CSS chunks on the fly and serves them dynamically.
 */
export type ViewsConfig =
  | boolean
  | {
      dir?: string;
      publicPath?: string;
      cacheDir?: string;
      hmr?: boolean;
    };

/**
 * Core initialization options for the Express Web Server Base (EWB).
 * Used when initializing a new `Server` instance.
 */
export type ServerOptions = Partial<{
  port: number;
  controllers: string | string[];
  swagger: SwaggerConfig;
  ratelimit: RateLimitConfig;
  cors: CorsConfig;
  views: ViewsConfig;
  plugins: BunPlugin[];
}>;

/**
 * Supported HTTP routing methods.
 */
export type Methods = "get" | "post" | "put" | "delete" | "patch";
