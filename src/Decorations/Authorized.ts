import { OpenAPIV3 } from "openapi-types";

// Key to store auth metadata
export const PUBLIC_METADATA_KEY = "auth:public";
export const ROLES_METADATA_KEY = "auth:roles";

export function Authorized(
  roles: string[] = [],
): MethodDecorator & ClassDecorator {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey) {
      Reflect.defineMetadata(ROLES_METADATA_KEY, roles, target, propertyKey);
    } else {
      Reflect.defineMetadata(ROLES_METADATA_KEY, roles, target);
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
