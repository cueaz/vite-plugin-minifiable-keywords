import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { Node } from 'estree';
import { walk } from 'estree-walker';
import fg from 'fast-glob';
import type { Logger } from 'vite';

export const PLUGIN_NAME = 'vite-plugin-keywords';
export const VIRTUAL_MODULE_ID = 'virtual:keywords';

export const DEFAULT_SRC_DIR = 'src';

export interface KeywordsPluginOptions {
  /**
   * Source directory for files to scan for keywords.
   * @default 'src'
   */
  srcDir?: string;
}

export const extractKeywords = (code: string): Set<string> => {
  const keywords = new Set<string>();
  let ast: Node;
  try {
    // Deviations from ESTree spec; not relevant for keyword extraction
    // ref: https://babeljs.io/docs/babel-parser#output
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    }) as unknown as Node;
  } catch (e) {
    return keywords;
  }

  let keywordNamespace: string | null = null;

  walk(ast, {
    enter(node) {
      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === VIRTUAL_MODULE_ID
      ) {
        const specifier = node.specifiers.find(
          (s) => s.type === 'ImportNamespaceSpecifier',
        );
        if (specifier) {
          keywordNamespace = specifier.local.name;
          this.skip();
        }
      }
    },
  });

  if (!keywordNamespace) {
    return keywords;
  }

  walk(ast, {
    enter(node) {
      if (
        node.type === 'MemberExpression' &&
        !node.computed && // Exclude computed properties like K['xyz']
        node.object.type === 'Identifier' &&
        node.object.name === keywordNamespace &&
        node.property.type === 'Identifier'
      ) {
        keywords.add(node.property.name);
      }
    },
  });

  return keywords;
};

export const generateTypesFile = async (
  collectedKeywords: Set<string>,
  root: string,
  dirname: string = '.keywords',
  filename: string = 'types.d.ts',
): Promise<void> => {
  const collectedType = [...collectedKeywords]
    .map((key) => `'${key}'`)
    .join(' | ');
  const content = `
/// <reference types="${PLUGIN_NAME}/global" />
declare module '${VIRTUAL_MODULE_ID}/types' {
  interface Types {
    collected: ${collectedKeywords.size > 0 ? collectedType : 'never'};
  }
}`;
  const pluginRoot = path.join(root, dirname);
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(path.join(pluginRoot, filename), `${content.trim()}\n`);
};

export const collectKeywordsFromFiles = async (
  srcDir: string,
  root: string,
  logger: Logger,
): Promise<Set<string>> => {
  const collectedKeywords = new Set<string>();

  logger.info(`[${PLUGIN_NAME}] Scanning project files for keywords...`);

  const files = await fg.glob(`${srcDir}/**/*.{js,ts,jsx,tsx}`, {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  await Promise.all(
    files.map(async (file) => {
      const code = await readFile(file, 'utf-8');
      const keywords = extractKeywords(code);
      for (const key of keywords) {
        collectedKeywords.add(key);
      }
    }),
  );

  logger.info(
    `[${PLUGIN_NAME}] Scan complete. Found ${collectedKeywords.size} unique keywords.`,
  );

  return collectedKeywords;
};
