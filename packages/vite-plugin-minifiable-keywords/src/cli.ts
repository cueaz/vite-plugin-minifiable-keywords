import { collectKeywordsAndGenerateTypes } from 'minifiable-keywords';
import { resolveConfig } from 'vite';
import { PLUGIN_NAME } from './shared';

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

  await collectKeywordsAndGenerateTypes(config.root, logger, PLUGIN_NAME, [
    config.build.outDir,
    config.cacheDir,
  ]);
};

await main();
