import type { CorsOptions } from "cors";
import type { Options } from "express-rate-limit";
import type { OpenAPIV3 } from "openapi-types";

export type SwaggerConfig =
  | boolean
  | {
      path?: string;
      options?: Omit<Partial<OpenAPIV3.Document>, "paths"> & { paths?: any };
    };

export type RateLimitConfig = boolean | Partial<Options>;

export type CorsConfig = boolean | CorsOptions;

export type ServerOptions = Partial<{
  port: number;
  controllers: string | string[];
  swagger: SwaggerConfig;
  ratelimit: RateLimitConfig;
  cors: CorsConfig;
}>;

export type Methods = "get" | "post" | "put" | "delete" | "patch";
