import {
  collectKeywordsAndGenerateTypes,
  createPrefixedLogger,
} from 'minifiable-keywords';
import { PLUGIN_NAME } from './shared';

const main = async () => {
  const root = process.cwd();
  const logger = createPrefixedLogger(console, PLUGIN_NAME);
  await collectKeywordsAndGenerateTypes(root, logger);
};

await main();
