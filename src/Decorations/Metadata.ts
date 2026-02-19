import "reflect-metadata";
import type { RequestHandler } from "express";

import { OpenAPIV3 } from "openapi-types";

export interface RouteDefinition {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string | RegExp;
  handlerName: string;
  swagger?: OpenAPIV3.OperationObject;
  middlewares?: RequestHandler[];
}

export interface ControllerDefinition {
  target: any;
  path: string;
  serverIds?: string[];
  routes: RouteDefinition[];
  tags?: string[];
  security?: OpenAPIV3.SecurityRequirementObject[];
  middlewares?: RequestHandler[];
}

export class MetadataStorage {
  private static _instance: MetadataStorage;
  private _controllers: ControllerDefinition[] = [];

  private constructor() {}

  public static get instance(): MetadataStorage {
    if (!MetadataStorage._instance) {
      MetadataStorage._instance = new MetadataStorage();
    }
    return MetadataStorage._instance;
  }

  public addController(controller: ControllerDefinition) {
    this._controllers.push(controller);
  }

  public getControllers(): ControllerDefinition[] {
    return this._controllers;
  }

  public addRoute(target: any, route: RouteDefinition) {
    const existingController = this._controllers.find(
      (c) => c.target === target,
    );
    if (existingController) {
      existingController.routes.push(route);
    } else {
      const routes: RouteDefinition[] =
        Reflect.getMetadata("routes", target) || [];
      routes.push(route);
      Reflect.defineMetadata("routes", routes, target);
    }
  }

  public getRoutes(target: any): RouteDefinition[] {
    return Reflect.getMetadata("routes", target) || [];
  }
}
