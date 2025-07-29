import { resolveConfig } from 'vite';
import {
  collectKeywordsFromFiles,
  generateTypesFile,
  PLUGIN_NAME,
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

  // const options = (keywordsPlugin as any).__OPTIONS__ as MinifiableKeywordsPluginOptions;

  const root = config.root;
  const collectedKeywords = await collectKeywordsFromFiles(
    root,
    logger,
    config.build.outDir,
    config.cacheDir,
  );
  await generateTypesFile(collectedKeywords, root);
};

await main();
