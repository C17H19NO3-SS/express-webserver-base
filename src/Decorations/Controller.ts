import { OpenAPIV3 } from "openapi-types";
import { MetadataStorage } from "./Metadata";

export interface ControllerOptions {
  serverIds?: string[];
  tags?: string[];
  security?: OpenAPIV3.SecurityRequirementObject[];
}

export function Controller(path: string, options?: ControllerOptions) {
  return function (target: Function) {
    const routes = MetadataStorage.instance.getRoutes(target);
    const controllerMiddlewares =
      Reflect.getMetadata("middlewares", target) || [];

    // Inject middleware into routes
    routes.forEach((route) => {
      route.middlewares =
        Reflect.getMetadata(
          "middlewares",
          target.prototype,
          route.handlerName,
        ) || [];
    });

    MetadataStorage.instance.addController({
      target: target as any,
      path: path,
      serverIds: options?.serverIds,
      tags: options?.tags,
      security: options?.security,
      middlewares: controllerMiddlewares,
      routes: routes,
    });
  };
}
