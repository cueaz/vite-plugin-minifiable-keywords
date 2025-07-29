# vite-plugin-minifiable-keywords

> [!NOTE]
> A Rollup version of this plugin, `rollup-plugin-minifiable-keywords`, is also available. The primary difference is that the Vite plugin utilizes the `hotUpdate` hook to incrementally collect keywords and update modules and types during development. While this documentation is written primarily for the Vite plugin, the setup is almost identical—just add `rollup-plugin-minifiable-keywords` to your Rollup configuration. Please be aware that the Rollup version has not been as extensively tested.

A Vite plugin that provides a way to use minifiable `Symbols` in place of string literals and object keys, aimed at developers focused on extreme minification.

This approach introduces a trade-off between a small reduction in bundle size and an increase in code complexity. It is best suited for ~~applications where every byte counts~~ minification nerds.

## Rationale

Modern JavaScript minifiers cannot shorten string literals, which are often used for object keys or as distinct values. This plugin offers a solution by providing a mechanism to use `Symbol` primitives in their place. Since these `Symbols` are assigned to variables, they can be minified, leading to a smaller final bundle.

Consider a standard JavaScript object. The property names are strings and will persist in the minified output.

**Standard Approach:**

```ts
// The keys 'userName' and 'preferredTheme' are string literals.
const userProfile = {
  userName: 'Alex' as string,
  preferredTheme: 'dark' as 'light' | 'dark',
};
console.log(userProfile.userName);

// Minified Output: The keys remain unchanged.
const a = { userName: 'Alex', preferredTheme: 'dark' };
console.log(a.userName);
```

This plugin allows you to adopt a different pattern, using `Symbols` instead of strings. These `Symbols` are imported from a virtual module provided by the plugin.

**With `vite-plugin-minifiable-keywords`:**

```ts
import * as K from 'virtual:keywords';

const userProfile = {
  [K.userName]: 'Alex' as string,
  [K.preferredTheme]: K.dark as typeof K.light | typeof K.dark,
};
console.log(userProfile[K.userName]);

// Minified Output: The variables representing the Symbols are shortened.
const b = Symbol();
const c = Symbol();
const d = Symbol();
const a = { [b]: 'Alex', [c]: d };
console.log(a[b]);
```

## How It Works

The plugin works by scanning your code for usages of the `virtual:keywords` module and generating the corresponding `Symbol` exports and types on the fly.

```ts
// virtual:keywords
export const userName = /* @__PURE__ */ Symbol();
export const preferredTheme = /* @__PURE__ */ Symbol();
export const dark = /* @__PURE__ */ Symbol();
export const light = /* @__PURE__ */ Symbol();
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
