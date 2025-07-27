import { resolveConfig } from 'vite';
import {
  collectKeywordsFromFiles,
  DEFAULT_SRC_DIR,
  generateTypesFile,
  PLUGIN_NAME,
  type KeywordsPluginOptions,
} from './shared';

const main = async () => {
  const config = await resolveConfig({}, 'build');
  const logger = config.logger;

  const keywordsPlugin = config.plugins.find(
    (plugin) => plugin.name === PLUGIN_NAME,
  );
  if (!keywordsPlugin) {
    logger.error(
      `[${PLUGIN_NAME}] Keywords plugin not found in Vite configuration.`,
    );
    process.exit(1);
  }

  const options = (keywordsPlugin as any).__OPTIONS__ as KeywordsPluginOptions;
  const { srcDir = DEFAULT_SRC_DIR } = options;

  const root = config.root;
  const collectedKeywords = await collectKeywordsFromFiles(
    srcDir,
    root,
    logger,
  );
  await generateTypesFile(collectedKeywords, root);
};

await main();
