declare module 'virtual:keywords/types' {
  type UnionToIntersection<U> = (
    U extends any ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never;

  type IntersectValues<T> = {
    [K in keyof T]: (x: T[K]) => void;
  }[keyof T] extends infer U
    ? UnionToIntersection<U> extends (x: infer P) => void
      ? P
      : never
    : never;

  interface Types {
    base: string;
  }

  export type KeywordsModule = {
    [K in IntersectValues<Types>]: symbol & { __KEYWORD__: K };
  };

  export type Keyword = KeywordsModule[keyof KeywordsModule];
}

declare module 'virtual:keywords' {
  import { KeywordsModule } from 'virtual:keywords/types';
  const module: KeywordsModule;
  export = module;
}
