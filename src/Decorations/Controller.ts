export const CONTROLLER_METADATA_KEY = Symbol("controller");

export function Controller(
  prefix: string = "",
  tags?: string[],
): ClassDecorator {
  return function (target: Object) {
    Reflect.defineMetadata(CONTROLLER_METADATA_KEY, { prefix, tags }, target);
  };
}
