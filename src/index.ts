import path from 'node:path';
import type { EnvironmentModuleGraph, Plugin, ResolvedConfig } from 'vite';
import {
  collectKeywordsFromFiles,
  extractKeywords,
  generateTypesFile,
  PLUGIN_NAME,
  VIRTUAL_MODULE_ID,
  type MinifiableKeywordsPluginOptions,
} from './shared';

const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

const splitQuery = (id: string) => id.split('?');

export { MinifiableKeywordsPluginOptions };

export const minifiableKeywordsPlugin = (
  options: MinifiableKeywordsPluginOptions = {},
): Plugin & { __OPTIONS__: MinifiableKeywordsPluginOptions } => {
  const collectedKeywords = new Set<string>();
  let config: ResolvedConfig;

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

  const invalidateModule = (
    absoluteId: string,
    moduleGraph: EnvironmentModuleGraph,
  ): void => {
    const module = moduleGraph.getModuleById(absoluteId);
    if (module) {
      moduleGraph.invalidateModule(module);
      module.lastHMRTimestamp = module.lastInvalidationTimestamp || Date.now();
    }
  };

  return {
    name: PLUGIN_NAME,
    __OPTIONS__: options,

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async buildStart() {
      collectedKeywords.clear();
      for (const key of await collectKeywordsFromFiles(
        config.root,
        config.logger,
        config.build.outDir,
        config.cacheDir,
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

    async hotUpdate({ type, file, read }) {
      if (type === 'delete') return;

      const fileExt = path.extname(file);
      if (
        !['.js', '.ts', '.jsx', '.tsx'].includes(fileExt) ||
        file.includes('/.')
      ) {
        return;
      }

      const code = await read();
      const keywordsInFile = extractKeywords(code);
      if (keywordsInFile.size === 0) return;

      const initialSize = collectedKeywords.size;
      for (const key of keywordsInFile) {
        collectedKeywords.add(key);
      }

      const newKeywordsAdded = collectedKeywords.size > initialSize;
      if (newKeywordsAdded) {
        invalidateModule(
          RESOLVED_VIRTUAL_MODULE_ID,
          this.environment.moduleGraph,
        );
        await generateTypesFile(collectedKeywords, config.root);
      }
    },
  };
};

export default minifiableKeywordsPlugin;
