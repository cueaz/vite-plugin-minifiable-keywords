declare module 'virtual:keywords/types' {
  type KeywordsBase<T extends string> = {
    [K in T]: symbol & { __KEYWORD__: K };
  };
  export type Keywords = KeywordsBase<string>;
  export type Keyword = Keywords[keyof Keywords];
}

declare module 'virtual:keywords' {
  import { Keywords } from 'virtual:keywords/types';
  const keywords: Keywords;
  export = keywords;
}
