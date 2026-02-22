export const AUTHORIZE_METADATA_KEY = Symbol("authorize");

export function Authorize(secret?: string): ClassDecorator & MethodDecorator {
  return function (
    target: any,
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
