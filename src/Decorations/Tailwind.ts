export const TAILWIND_METADATA_KEY = "serve:tailwind";

export interface TailwindOptions {
  enable?: boolean;
  plugins?: any[]; // Bun plugins
}

export function Tailwindcss(options: TailwindOptions = {}): ClassDecorator {
  return function (target: any) {
    const defaultOptions: TailwindOptions = { enable: true, plugins: [] };
    const finalOptions = { ...defaultOptions, ...options };
    Reflect.defineMetadata(TAILWIND_METADATA_KEY, finalOptions, target);
  };
}
