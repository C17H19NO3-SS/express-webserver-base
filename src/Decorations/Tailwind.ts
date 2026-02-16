export const TAILWIND_METADATA_KEY = "serve:tailwind";

export function Tailwindcss(): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(TAILWIND_METADATA_KEY, true, target);
  };
}
