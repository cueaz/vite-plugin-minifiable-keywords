import {
  collectKeywordsAndGenerateTypes,
  createPrefixedLogger,
} from 'minifiable-keywords';
import { resolveConfig } from 'vite';
import { PLUGIN_NAME } from './shared';

const main = async () => {
  const config = await resolveConfig({}, 'build');
  const logger = createPrefixedLogger(config.logger, PLUGIN_NAME);

  // const keywordsPlugin = config.plugins.find(
  //   (plugin) => plugin.name === PLUGIN_NAME,
  // );
  // if (!keywordsPlugin) {
  //   logger.error('Keywords plugin not found in Vite configuration.');
  //   process.exit(1);
  // }

  await collectKeywordsAndGenerateTypes(config.root, logger, [
    config.build.outDir,
    config.cacheDir,
  ]);
};

await main();
