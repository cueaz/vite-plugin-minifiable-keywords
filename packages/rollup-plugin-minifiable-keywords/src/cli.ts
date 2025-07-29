import { collectKeywordsAndGenerateTypes } from 'minifiable-keywords';
import { PLUGIN_NAME } from './shared';

const main = async () => {
  const root = process.cwd();
  const logger = console;
  await collectKeywordsAndGenerateTypes(root, logger, PLUGIN_NAME);
};

await main();
