import "reflect-metadata";
import { describe, expect, test } from "bun:test";
import {
  Controller,
  CONTROLLER_METADATA_KEY,
} from "../src/Decorations/Controller";
import { Get, Post, ROUTE_METADATA_KEY } from "../src/Decorations/Methods";
import {
  Authorize,
  AUTHORIZE_METADATA_KEY,
} from "../src/Decorations/Authorize";
import {
  AuthRequired,
  AUTH_REQUIRED_METADATA_KEY,
} from "../src/Decorations/AuthRequired";

describe("Decorators", () => {
  test("@Controller sets prefix and tags", () => {
    @Controller("/api", ["System"])
    class TestController {}

    const metadata = Reflect.getMetadata(
      CONTROLLER_METADATA_KEY,
      TestController,
    );
    expect(metadata).toEqual({ prefix: "/api", tags: ["System"] });
  });

  test("Method decorators set path, method and swaggerOptions", () => {
    class TestController {
      @Get("/test", { summary: "Test Get" })
      getTest() {}

      @Post("/create", { summary: "Test Post" })
      postTest() {}
    }

    const getMetadata = Reflect.getMetadata(
      ROUTE_METADATA_KEY,
      TestController.prototype,
      "getTest",
    );
    expect(getMetadata).toEqual({
      path: "/test",
      method: "get",
      handlerName: "getTest",
      swaggerOptions: { summary: "Test Get" },
    });

    const postMetadata = Reflect.getMetadata(
      ROUTE_METADATA_KEY,
      TestController.prototype,
      "postTest",
    );
    expect(postMetadata).toEqual({
      path: "/create",
      method: "post",
      handlerName: "postTest",
      swaggerOptions: { summary: "Test Post" },
    });
  });

  test("@Authorize sets secret metadata", () => {
    @Authorize("custom_secret")
    class TestAuthClass {}

    const metadata = Reflect.getMetadata(AUTHORIZE_METADATA_KEY, TestAuthClass);
    expect(metadata).toEqual({ secret: "custom_secret" });

    class TestAuthMethodClass {
      @Authorize("method_secret")
      testMethod() {}
    }

    const methodMetadata = Reflect.getMetadata(
      AUTHORIZE_METADATA_KEY,
      TestAuthMethodClass.prototype,
      "testMethod",
    );
    expect(methodMetadata).toEqual({ secret: "method_secret" });
  });

  test("@AuthRequired sets boolean flag metadata", () => {
    @AuthRequired()
    class ReqClass {}

    const metadata = Reflect.getMetadata(AUTH_REQUIRED_METADATA_KEY, ReqClass);
    expect(metadata).toBeTrue();

    class ReqMethodClass {
      @AuthRequired()
      testMethod() {}
    }

    const methodMetadata = Reflect.getMetadata(
      AUTH_REQUIRED_METADATA_KEY,
      ReqMethodClass.prototype,
      "testMethod",
    );
    expect(methodMetadata).toBeTrue();
  });
});
