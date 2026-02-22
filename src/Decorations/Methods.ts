import type { OpenAPIV3 } from "openapi-types";

export const ROUTE_METADATA_KEY = Symbol("route");

function createMethodDecorator(method: string) {
  return function (
    path: string = "/",
    swaggerOptions?: Partial<OpenAPIV3.OperationObject>,
  ): MethodDecorator {
    return function (
      target: Object,
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

export const Get = createMethodDecorator("get");
export const Post = createMethodDecorator("post");
export const Put = createMethodDecorator("put");
export const Delete = createMethodDecorator("delete");
export const Patch = createMethodDecorator("patch");
export const Options = createMethodDecorator("options");
export const Head = createMethodDecorator("head");
