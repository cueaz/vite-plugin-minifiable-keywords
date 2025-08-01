# vite-plugin-minifiable-keywords

[![NPM][npm-badge]][npm-url]
[![Github CI][ci-badge]][ci-url]
[![MIT licensed][license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/vite-plugin-minifiable-keywords.svg
[npm-url]: https://www.npmjs.com/package/vite-plugin-minifiable-keywords
[ci-badge]: https://github.com/cueaz/vite-plugin-minifiable-keywords/actions/workflows/ci.yaml/badge.svg
[ci-url]: https://github.com/cueaz/vite-plugin-minifiable-keywords/actions/workflows/ci.yaml
[license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: https://github.com/cueaz/vite-plugin-minifiable-keywords/blob/main/LICENSE

> [!NOTE]
> A Rollup version of this plugin, `rollup-plugin-minifiable-keywords`, is also available. The primary difference is that the Vite plugin utilizes the `hotUpdate` hook to incrementally collect keywords and update modules and types during development. While this documentation is written primarily for the Vite plugin, the setup is almost identical—just add `rollup-plugin-minifiable-keywords` to your Rollup configuration.

A Vite plugin that provides a way to use minifiable `Symbols` in place of string literals and object keys, offering a potential strategy for extreme minification.

This approach introduces a trade-off between a small reduction in bundle size and an increase in code complexity. It is best suited for ~~applications where every byte counts~~ minification nerds.

## Rationale

A common pattern in JavaScript applications, particularly in state management, involves using string literals as unique identifiers.

```ts
// A typical action in a state management system
function setUser(name: string) {
  return {
    type: 'SET_USER',
    payload: { name },
  };
}
```

While minifiers can shorten variable and function names, they cannot alter the string literals. When an application defines dozens of these identifiers, they accumulate as unminifiable overhead in the final bundle.

This plugin addresses this by enabling the use of `Symbol` primitives, which, when assigned to variables, can be safely minified.

**Standard Approach:**

In this standard pattern, both the property key `type` and `payload`, and the type value `'SET_USER'` are strings that resist minification.

```ts
interface SetUserAction {
  type: 'SET_USER';
  payload: { name: string };
}
const setUser = (payload: { name: string }): SetUserAction => ({
  type: 'SET_USER',
  payload,
});

function reducer(state: any, action: SetUserAction) {
  if (action.type === 'SET_USER') {
    // use action.payload
  }
}

// Minified Output: The strings 'type', 'payload', and 'SET_USER' persist.
// prettier-ignore
const a=p=>({type:'SET_USER',payload:p});
// prettier-ignore
function b(s,a){if(a.type==='SET_USER'){/*...*/}}
```

**With `vite-plugin-minifiable-keywords`:**

By importing from the `virtual:keywords` module, you can replace internal, structural strings with minifiable `Symbol` variables, while leaving the data model intact.

```ts
import * as K from 'virtual:keywords';

interface SetUserAction {
  [K.type]: typeof K.SET_USER;
  // The payload's structure remains unchanged for compatibility with external data sources.
  [K.payload]: { name: string };
}
const setUser = (payload: { name: string }): SetUserAction => ({
  [K.type]: K.SET_USER,
  [K.payload]: payload,
});

function reducer(state: any, action: SetUserAction) {
  if (action[K.type] === K.SET_USER) {
    // use action[K.payload]
  }
}

// Minified Output: All structural identifiers become single-character variables.
// prettier-ignore
const a=Symbol(),b=Symbol(),c=Symbol();
// prettier-ignore
const d=p=>({[a]:b,[c]:p});
// prettier-ignore
function e(s,f){if(f[a]===b){/*...*/}}
```

This transforms static string overhead into minifiable variables, allowing the minifier to do what it does best.

## Comparison to Property Mangling

Property mangling lacks the semantic context to know which keys are safe to alter, often relying on fragile regex or naming conventions. This plugin takes a different approach by operating on explicit developer intent. Rather than asking a minifier to guess, you refactor a string literal into a minifiable variable (`K.myKeyword`) that holds a unique `Symbol`. This provides an unambiguous, structural hint to the build process, enabling safe and predictable minification of identifiers without the risks associated with global property renaming.

## How It Works

The plugin works by scanning your code for usages of the `virtual:keywords` module and generating the corresponding `Symbol` exports and types on the fly.

```ts
// virtual:keywords
export const type = /* @__PURE__ */ Symbol();
export const payload = /* @__PURE__ */ Symbol();
export const SET_USER = /* @__PURE__ */ Symbol();
// ... and so on for all other keywords found.
```

## Installation

```bash
npm install -D vite-plugin-minifiable-keywords
# or
yarn add -D vite-plugin-minifiable-keywords
# or
pnpm add -D vite-plugin-minifiable-keywords
```

## Setup

1.  Add the plugin to your `vite.config.ts`.

    ```ts
    // vite.config.ts
    import { defineConfig } from 'vite';
    import keywords from 'vite-plugin-minifiable-keywords';

    export default defineConfig({
      plugins: [keywords()],
    });
    ```

2.  Include the generated types file in your `tsconfig.json` or `src/env.d.ts`.

    ```jsonc
    // tsconfig.json
    {
      // ...
      "include": [
        "src",
        ".keywords/types.d.ts", // Add this line
      ],
    }
    ```

    ```ts
    // src/env.d.ts
    /// <reference path="../.keywords/types.d.ts" />
    ```

3.  Exclude the generated types file from your version control system (e.g., Git).

    ```gitignore
    # .gitignore
    .keywords/
    ```

4.  Ensure that your type-checking script in `package.json` is updated to run the plugin first:

    ```jsonc
    // package.json
    {
      "scripts": {
        "typecheck": "keywords && tsc --noEmit",
      },
    }
    ```

5.  The `.keywords/types.d.ts` type file is created automatically on `vite dev/build`, or manually via the `keywords` script.

## Options

None

## Limitations

- **Frameworks**: The plugin uses Babel to parse JavaScript and TypeScript files. It cannot parse keywords from inside the template blocks of frameworks like Vue, Svelte, or Astro.
- **Dynamic Access**: Only static property access (e.g., `K.myKeyword`) is detected. Dynamic, computed access (e.g., `K['myKeyword']`) will not be identified by the plugin.

## License

MIT
