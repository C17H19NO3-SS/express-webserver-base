export const AUTHORIZE_METADATA_KEY = Symbol("authorize");

/**
 * Enables JWT decoding and payload injection for a controller or endpoint.
 * Binds the extracted JWT payload to the `user` parameter of your route handler.
 * @param secret Optional custom JWT verification secret (defaults to `process.env.JWT_SECRET`).
 */
export function Authorize(secret?: string): ClassDecorator & MethodDecorator {
  return function (
    target: Function | Object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey) {
      Reflect.defineMetadata(
        AUTHORIZE_METADATA_KEY,
        { secret },
        target,
        propertyKey,
      );
    } else {
      Reflect.defineMetadata(AUTHORIZE_METADATA_KEY, { secret }, target);
    }
  };
}
