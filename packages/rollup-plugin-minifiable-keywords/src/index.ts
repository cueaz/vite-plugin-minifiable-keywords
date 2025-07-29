import {
  collectKeywordsAndGenerateTypes,
  generateModuleCode,
  RESOLVED_VIRTUAL_MODULE_ID,
  splitQuery,
  VIRTUAL_MODULE_ID,
  type Logger,
} from 'minifiable-keywords';
import type { Plugin } from 'rollup';
import { PLUGIN_NAME } from './shared';

export const minifiableKeywordsPlugin = (): Plugin => {
  let collectedKeywords: Set<string>;
  let logger: Logger;
  const root = process.cwd();
  const isDev = process.env.NODE_ENV === 'development';

  return {
    name: PLUGIN_NAME,

    async buildStart() {
      const pluginThis = this;
      logger = {
        info: pluginThis.info,
        warn: pluginThis.warn,
        error: pluginThis.error,
      };
      collectedKeywords = await collectKeywordsAndGenerateTypes(
        root,
        logger,
        PLUGIN_NAME,
      );
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
        return generateModuleCode(collectedKeywords, isDev);
      }
    },
  };
};

export default minifiableKeywordsPlugin;
