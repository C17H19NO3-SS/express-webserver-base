import type { OpenAPIV3 } from "openapi-types";

export const ROUTE_METADATA_KEY = Symbol("route");

function createMethodDecorator(method: string) {
  return function (
    path: string = "/",
    swaggerOptions?: Partial<OpenAPIV3.OperationObject>,
  ): any {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      const defaultSwagger: Partial<OpenAPIV3.OperationObject> = {
        summary: `${String(propertyKey)} endpoint`,
        description: `Auto-generated documentation for ${method.toUpperCase()} ${path}`,
        responses: {
          "200": {
            description: "Successful response",
          },
        },
      };

      Reflect.defineMetadata(
        ROUTE_METADATA_KEY,
        {
          path,
          method,
          handlerName: propertyKey,
          swaggerOptions: { ...defaultSwagger, ...swaggerOptions },
        },
        target,
        propertyKey,
      );
    };
  };
}

/**
 * Decorator to map a controller method to an Express `GET` route.
 * @param path The relative routing path (e.g. `"/users"`).
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Get = createMethodDecorator("get");

/**
 * Decorator to map a controller method to an Express `POST` route.
 * @param path The relative routing path (e.g. `"/create"`).
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Post = createMethodDecorator("post");

/**
 * Decorator to map a controller method to an Express `PUT` route.
 * @param path The relative routing path.
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Put = createMethodDecorator("put");

/**
 * Decorator to map a controller method to an Express `DELETE` route.
 * @param path The relative routing path.
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Delete = createMethodDecorator("delete");

/**
 * Decorator to map a controller method to an Express `PATCH` route.
 * @param path The relative routing path.
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Patch = createMethodDecorator("patch");

/**
 * Decorator to map a controller method to an Express `OPTIONS` route.
 * @param path The relative routing path.
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Options = createMethodDecorator("options");

/**
 * Decorator to map a controller method to an Express `HEAD` route.
 * @param path The relative routing path.
 * @param swaggerOptions (Optional) Custom Swagger/OpenAPI documentation settings for this route.
 */
export const Head = createMethodDecorator("head");
