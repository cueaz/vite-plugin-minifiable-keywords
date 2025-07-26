import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { Node } from 'estree';
import { walk } from 'estree-walker';
import fg from 'fast-glob';
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';

const PLUGIN_NAME = 'vite-plugin-keywords';

const VIRTUAL_MODULE_ID = 'virtual:keywords';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

const splitQuery = (id: string) => id.split('?');

export interface KeywordsPluginOptions {
  /**
   * Glob patterns for files to scan for keywords.
   * @default 'src/**\/*.{js,ts,jsx,tsx}'
   */
  include?: string | string[];
}

const extractKeywords = (code: string): Set<string> => {
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

export const keywordsPlugin = (options: KeywordsPluginOptions = {}): Plugin => {
  const collectedKeywords = new Set<string>();
  let server: ViteDevServer | null = null;
  let config: ResolvedConfig;

  const { include = 'src/**/*.{js,ts,jsx,tsx}' } = options;

  const generateModuleCode = (): string => {
    const exports = [...collectedKeywords]
      .map((key) => `export const ${key} = /* @__PURE__ */ Symbol();\n`)
      .join('');
    return exports;
  };

  const generateTypesFile = async (
    directory: string = '.keywords',
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
    const root = path.posix.join(config.root, directory);
    await mkdir(root, { recursive: true });
    await writeFile(path.posix.join(root, filename), `${content.trim()}\n`);
  };

  const invalidateModule = (absoluteId: string): void => {
    if (!server) return;
    const { moduleGraph } = server;
    const module = moduleGraph.getModuleById(absoluteId);
    if (module) {
      moduleGraph.invalidateModule(module);
      module.lastHMRTimestamp = module.lastInvalidationTimestamp || Date.now();
    }
  };

  return {
    name: PLUGIN_NAME,

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    configureServer(devServer) {
      server = devServer;
    },

    async buildStart() {
      if (config.command !== 'build') return;

      config.logger.info(
        `[${PLUGIN_NAME}] Scanning project files for keywords...`,
      );

      const files = await fg.glob(include, {
        cwd: config.root,
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

      config.logger.info(
        `[${PLUGIN_NAME}] Scan complete. Found ${collectedKeywords.size} unique keywords.`,
      );

      await generateTypesFile();
    },

    resolveId(source, importer) {
      if (!importer) {
        return;
      }
      const [validSource] = splitQuery(source);
      if (validSource === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      const [validId] = splitQuery(id);
      if (validId === RESOLVED_VIRTUAL_MODULE_ID) {
        return generateModuleCode();
      }
    },

    async transform(code, id) {
      if (config.command === 'build') return;

      const [validId] = splitQuery(id);
      const fileExt = path.extname(validId);
      if (
        !['.js', '.ts', '.jsx', '.tsx'].includes(fileExt) ||
        validId.includes('node_modules')
      ) {
        return;
      }

      const keywordsInFile = extractKeywords(code);
      if (keywordsInFile.size === 0) return;

      const initialSize = collectedKeywords.size;
      for (const key of keywordsInFile) {
        collectedKeywords.add(key);
      }

      const newKeywordsAdded = collectedKeywords.size > initialSize;
      if (server && newKeywordsAdded) {
        invalidateModule(RESOLVED_VIRTUAL_MODULE_ID);
        await generateTypesFile();
      }
    },
  };
};

export default keywordsPlugin;
