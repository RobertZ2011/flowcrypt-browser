/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { getFilesInDir } from './utils/tooling-utils';

const OUT_DIR = `../build/chrome-consumer/js/content_scripts`;
const { compilerOptions: { outDir: sourceDir } } = JSON.parse(readFileSync('./tsconfig.content_scripts.json').toString());

const processedSrc = (srcFilePath: string) => {
  let file = readFileSync(srcFilePath).toString();
  file = file.replace(/^(import .*)$/gm, '// $1'); // comment out import statements
  file = file.replace(/^export (.*)$/gm, '$1 // export'); // remove export statements
  return file;
};

const buildContentScript = (srcFilePaths: string[], outFileName: string) => {
  let contentScriptBundle = '';
  for (const filePath of srcFilePaths) {
    contentScriptBundle += `\n/* ----- ${filePath.replace(sourceDir, '')} ----- */\n\n${processedSrc(filePath)}\n`;
  }
  contentScriptBundle = `(() => {\n${contentScriptBundle}\n})();\n`;
  writeFileSync(`${OUT_DIR}/${outFileName}`, contentScriptBundle);
};

mkdirSync(OUT_DIR);

// webmail
buildContentScript(([] as string[]).concat(
  getFilesInDir(`${sourceDir}/common/platform`, /\.js$/, false),
  getFilesInDir(`${sourceDir}/common/core`, /\.js$/, false),
  getFilesInDir(`${sourceDir}/common/api`, /\.js$/, false),
  getFilesInDir(`${sourceDir}/common`, /\.js$/, false),
  getFilesInDir(`${sourceDir}/content_scripts/webmail`, /\.js$/),
), 'webmail_bundle.js');

// checkout
buildContentScript([
  `${sourceDir}/common/platform/catch.js`,
  `${sourceDir}/common/core/common.js`,
  `${sourceDir}/common/browser.js`,
  `${sourceDir}/common/extension.js`,
  `${sourceDir}/content_scripts/checkout/stripe.js`,
], 'stripe_bundle.js');
