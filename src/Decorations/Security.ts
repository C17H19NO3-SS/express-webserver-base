import "reflect-metadata";

export const SECURITY_METADATA_KEY = Symbol("security");

export interface SecurityRequirement {
  [name: string]: string[];
}

export function Security(
  name: string,
  scopes: string[] = [],
): MethodDecorator & ClassDecorator {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey) {
      // Method decorator
      const existing: SecurityRequirement[] =
        Reflect.getMetadata(SECURITY_METADATA_KEY, target, propertyKey) || [];
      existing.push({ [name]: scopes });
      Reflect.defineMetadata(
        SECURITY_METADATA_KEY,
        existing,
        target,
        propertyKey,
      );
    } else {
      // Class decorator
      const existing: SecurityRequirement[] =
        Reflect.getMetadata(SECURITY_METADATA_KEY, target) || [];
      existing.push({ [name]: scopes });
      Reflect.defineMetadata(SECURITY_METADATA_KEY, existing, target);
    }
  };
}

export function ApiKey(name: string): MethodDecorator & ClassDecorator {
  return Security(name, []);
}
