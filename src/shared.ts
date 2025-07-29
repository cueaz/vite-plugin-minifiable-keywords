import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse, { type Node } from '@babel/traverse';
import { glob } from 'tinyglobby';
import type { Logger } from 'vite';

export const PLUGIN_NAME = 'vite-plugin-minifiable-keywords';
export const VIRTUAL_MODULE_ID = 'virtual:keywords';

export interface MinifiableKeywordsPluginOptions {}

// ref: https://github.com/babel/babel/discussions/13093
const traverse =
  typeof _traverse === 'function'
    ? _traverse
    : ((_traverse as any).default as typeof _traverse);

export const extractKeywords = (code: string): Set<string> => {
  const keywords = new Set<string>();
  let ast: Node;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch (e) {
    return keywords;
  }

  let keywordNamespace: string | null = null;

  traverse(ast, {
    enter(nodePath) {
      const node = nodePath.node;
      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === VIRTUAL_MODULE_ID
      ) {
        const specifier = node.specifiers.find(
          (s) => s.type === 'ImportNamespaceSpecifier',
        );
        if (specifier) {
          keywordNamespace = specifier.local.name;
          nodePath.stop();
        }
      }
    },
  });

  if (!keywordNamespace) {
    return keywords;
  }

  traverse(ast, {
    enter(nodePath) {
      const node = nodePath.node;

      if (
        node.type === 'MemberExpression' &&
        !node.computed && // Exclude computed properties like K['xyz']
        node.object.type === 'Identifier' &&
        node.object.name === keywordNamespace &&
        node.property.type === 'Identifier'
      ) {
        keywords.add(node.property.name);
      }

      if (
        node.type === 'TSQualifiedName' &&
        node.left.type === 'Identifier' &&
        node.left.name === keywordNamespace &&
        node.right.type === 'Identifier'
      ) {
        keywords.add(node.right.name);
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
  root: string,
  logger: Logger,
  outDir: string,
  cacheDir: string,
): Promise<Set<string>> => {
  const collectedKeywords = new Set<string>();

  logger.info(`[${PLUGIN_NAME}] Scanning project files for keywords...`);

  const files = await glob('**/*.{js,ts,jsx,tsx}', {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**', `${outDir}/**`, `${cacheDir}/**`],
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
