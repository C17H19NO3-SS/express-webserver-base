export const AUTH_REQUIRED_METADATA_KEY = Symbol("authR_required");

export function AuthRequired(): ClassDecorator & MethodDecorator {
  return function (
    target: Function | Object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey) {
      Reflect.defineMetadata(
        AUTH_REQUIRED_METADATA_KEY,
        true,
        target,
        propertyKey,
      );
    } else {
      Reflect.defineMetadata(AUTH_REQUIRED_METADATA_KEY, true, target);
    }
  };
}
