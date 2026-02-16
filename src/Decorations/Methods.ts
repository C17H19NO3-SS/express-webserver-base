import "reflect-metadata";
import { MetadataStorage, type RouteDefinition } from "./Metadata";
import { OpenAPIV3 } from "openapi-types";

export function Get(
  path: string,
  swagger?: OpenAPIV3.OperationObject,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    MetadataStorage.instance.addRoute(target.constructor, {
      method: "get",
      path,
      handlerName: propertyKey as string,
      swagger,
    });
  };
}

export function Post(
  path: string,
  swagger?: OpenAPIV3.OperationObject,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    MetadataStorage.instance.addRoute(target.constructor, {
      method: "post",
      path,
      handlerName: propertyKey as string,
      swagger,
    });
  };
}

export function Put(
  path: string,
  swagger?: OpenAPIV3.OperationObject,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    MetadataStorage.instance.addRoute(target.constructor, {
      method: "put",
      path,
      handlerName: propertyKey as string,
      swagger,
    });
  };
}

export function Delete(
  path: string,
  swagger?: OpenAPIV3.OperationObject,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    MetadataStorage.instance.addRoute(target.constructor, {
      method: "delete",
      path,
      handlerName: propertyKey as string,
      swagger,
    });
  };
}

export function Patch(
  path: string,
  swagger?: OpenAPIV3.OperationObject,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    MetadataStorage.instance.addRoute(target.constructor, {
      method: "patch",
      path,
      handlerName: propertyKey as string,
      swagger,
    });
  };
}
