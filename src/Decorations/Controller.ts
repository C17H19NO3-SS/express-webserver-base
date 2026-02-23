export const CONTROLLER_METADATA_KEY = Symbol("controller");

/**
 * Defines a class as an Express Web Server Controller.
 * Binds all methods decorated with `@Get()`, `@Post()`, etc. to the underlying Express app.
 * @param prefix The base routing path for the controller (e.g. `"/users"`).
 * @param tags An array of string tags used for Swagger/OpenAPI conceptual grouping.
 */
export function Controller(
  prefix: string = "",
  tags?: string[],
): ClassDecorator {
  return function (target: Object) {
    Reflect.defineMetadata(CONTROLLER_METADATA_KEY, { prefix, tags }, target);
  };
}
