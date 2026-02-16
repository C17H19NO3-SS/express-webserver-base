import { OpenAPIV3 } from "openapi-types";

// Key to store auth metadata
export const AUTH_METADATA_KEY = "auth:info";
export const PUBLIC_METADATA_KEY = "auth:public";

export interface AuthInfo {
  secret?: string;
}

export function BearerAuth(secret?: string): Function {
  return function (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) {
    // If used on a method
    if (propertyKey) {
      Reflect.defineMetadata(
        AUTH_METADATA_KEY,
        { secret },
        target,
        propertyKey,
      );
    } else {
      // If used on a class
      Reflect.defineMetadata(AUTH_METADATA_KEY, { secret }, target);
    }
  };
}

export function Public(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(PUBLIC_METADATA_KEY, true, target, propertyKey);
  };
}
