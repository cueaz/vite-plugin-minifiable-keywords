# vite-plugin-keywords

A Vite plugin that provides a way to use minifiable `Symbols` in place of string literals and object keys, aimed at developers focused on extreme minification.

Modern JavaScript minifiers cannot shorten string literals, which are often used for object keys or as distinct values. This plugin offers a solution by providing a mechanism to use `Symbol` primitives in their place. Since these `Symbols` are assigned to variables, they can be minified, leading to a smaller final bundle.

This approach introduces a trade-off between a small reduction in bundle size and an increase in code complexity. It is best suited for ~~performance-critical libraries or applications where every byte counts~~ minification nerds.

## How It Works: The Core Problem and Solution

Consider a standard JavaScript object. The property names are strings and will persist in the minified output.

**Standard Approach:**

```ts
// The keys 'userName' and 'preferredTheme' are string literals.
const userProfile = {
  userName: 'Alex',
  preferredTheme: 'dark',
};

// Minified Output: The keys remain unchanged.
const a = { userName: 'Alex', preferredTheme: 'dark' };
```

This plugin allows you to adopt a different pattern, using `Symbols` instead of strings. These `Symbols` are imported from a virtual module provided by the plugin.

**With `vite-plugin-keywords`:**

```ts
import * as K from 'virtual:keywords';

const userProfile = {
  [K.userName]: 'Alex',
  [K.preferredTheme]: 'dark',
};

// Minified Output: The variables representing the Symbols are shortened.
const b = Symbol();
const c = Symbol();
const a = { [b]: 'Alex', [c]: 'dark' };
```

## Installation

```bash
npm install -D vite-plugin-keywords
# or
yarn add -D vite-plugin-keywords
# or
pnpm add -D vite-plugin-keywords
```

## Setup

1.  Add the plugin to your `vite.config.ts`.

    ```ts
    // vite.config.ts
    import { defineConfig } from 'vite';
    import keywords from 'vite-plugin-keywords';

    export default defineConfig({
      plugins: [keywords()],
    });
    ```

2.  For TypeScript projects, include the generated types file in your `tsconfig.json` or `src/env.d.ts`.

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

## Usage Example

The plugin works by scanning your code for usages of the `virtual:keywords` module and generating the corresponding `Symbol` exports and types on the fly. You, the developer, choose where to use these `Symbols` instead of plain strings.

### Using Symbols for Type-Safe Literals

This technique can also be applied to string unions, providing type safety while reducing bundle size.

<table>
<thead>
  <tr>
    <th>Standard Approach</th>
    <th>Using Symbols via this Plugin</th>
  </tr>
</thead>
<tbody>
<tr>
<td valign="top">

```tsx
// src/components/Button.tsx

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  variant: ButtonVariant;
  children: React.ReactNode;
}

const Button = ({ variant, children }: ButtonProps) => {
  // ...
};

// Usage
<Button variant="primary">Click Me</Button>;
```

</td>
<td valign="top">

```tsx
// src/components/Button.tsx
import * as K from 'virtual:keywords';

type ButtonVariant = typeof K.primary | typeof K.secondary | typeof K.danger;

interface ButtonProps {
  variant: ButtonVariant;
  children: React.ReactNode;
}

const Button = ({ variant, children }: ButtonProps) => {
  // ...
};

// Usage
<Button variant={K.primary}>Click Me</Button>;
```

</td>
</tr>
</tbody>
</table>

## Options

```ts
// vite.config.ts
import keywords from 'vite-plugin-keywords';

export default {
  plugins: [
    keywords({
      /**
       * Source directory for files to scan for keywords.
       * @default 'src'
       */
      srcDir: 'src',
    }),
  ],
};
```

## Technical Limitations

- **Frameworks**: The plugin uses Babel to parse JavaScript and TypeScript files. It cannot parse keywords from inside the template blocks of frameworks like Vue, Svelte, or Astro.
- **Dynamic Access**: Only static property access (e.g., `K.myKeyword`) is detected. Dynamic, computed access (e.g., `K['myKeyword']`) will not be identified by the plugin.

## License

MIT
