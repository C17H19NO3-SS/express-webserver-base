import type { Request, Response, NextFunction } from "express";
import { ServeMemoryStore } from "../Components/ServeMemoryStore";
import { TAILWIND_METADATA_KEY } from "./Tailwind";

export const SERVE_HTML_METADATA_KEY = "serve:html";

export function Serve(htmlPath: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    // Store the HTML path in metadata for pre-building
    Reflect.defineMetadata(
      SERVE_HTML_METADATA_KEY,
      htmlPath,
      target,
      propertyKey,
    );

    const originalMethod = descriptor.value;

    descriptor.value = async function ({
      req,
      res,
      user,
      next,
    }: {
      req: Request;
      res: Response;
      user: any;
      next: NextFunction;
    }) {
      try {
        // Execute the original method
        const result = await originalMethod.apply(this, [
          { req, res, user, next },
        ]);

        // Check if response has been sent or if result is not undefined/void
        if (res.headersSent || result !== undefined) {
          return result;
        }

        // Check if Tailwind is enabled for the controller
        const tailwindOptions =
          Reflect.getMetadata(TAILWIND_METADATA_KEY, target.constructor) || {};

        // If no response, build and serve the HTML
        const html = await ServeMemoryStore.instance.buildAndCache(
          htmlPath,
          tailwindOptions,
        );
        if (html) {
          const devMode = process.env.NODE_ENV === "development";
          if (devMode) {
            res.setHeader(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            );
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          }
          res.type("html").send(html);
        } else if (next) {
          next(); // No HTML found?
        }
      } catch (error) {
        if (next) {
          next(error);
        } else {
          throw error;
        }
      }
    };

    return descriptor;
  };
}
