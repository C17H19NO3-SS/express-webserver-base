import "reflect-metadata";
import type { RequestHandler } from "express";

export function Use(...middlewares: RequestHandler[]) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey) {
      // Method Level Decorator
      const current =
        Reflect.getMetadata("middlewares", target, propertyKey) || [];
      Reflect.defineMetadata(
        "middlewares",
        [...current, ...middlewares],
        target,
        propertyKey,
      );
    } else {
      // Class Level Decorator
      // Note: For constructor, target is the constructor itself
      const current = Reflect.getMetadata("middlewares", target) || [];
      Reflect.defineMetadata(
        "middlewares",
        [...current, ...middlewares],
        target,
      );
    }
  };
}
