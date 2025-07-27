import path from 'node:path';
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import {
  collectKeywordsFromFiles,
  DEFAULT_SRC_DIR,
  extractKeywords,
  generateTypesFile,
  PLUGIN_NAME,
  VIRTUAL_MODULE_ID,
  type KeywordsPluginOptions,
} from './shared';

const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

const splitQuery = (id: string) => id.split('?');

export { KeywordsPluginOptions };

export const keywordsPlugin = (
  options: KeywordsPluginOptions = {},
): Plugin & { __OPTIONS__: KeywordsPluginOptions } => {
  const collectedKeywords = new Set<string>();
  let server: ViteDevServer | null = null;
  let config: ResolvedConfig;

  const { srcDir = DEFAULT_SRC_DIR } = options;

  const generateModuleCode = (): string => {
    const isDev = config.mode !== 'production';
    const exports = [...collectedKeywords]
      .map(
        (key) =>
          `export const ${key} = /* @__PURE__ */ Symbol(${isDev ? `'${key}'` : ''});\n`,
      )
      .join('');
    return exports;
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
    enforce: 'pre', // Ensure this plugin runs before TypeScript type removal
    __OPTIONS__: options,

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    configureServer(devServer) {
      server = devServer;
    },

    async buildStart() {
      collectedKeywords.clear();
      for (const key of await collectKeywordsFromFiles(
        srcDir,
        config.root,
        config.logger,
      )) {
        collectedKeywords.add(key);
      }
      await generateTypesFile(collectedKeywords, config.root);
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
      if (newKeywordsAdded) {
        invalidateModule(RESOLVED_VIRTUAL_MODULE_ID);
        await generateTypesFile(collectedKeywords, config.root);
      }
    },
  };
};

export default keywordsPlugin;
