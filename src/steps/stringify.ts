/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { Helix } from '@adobe/helix-universal';
import { toHtml } from 'hast-util-to-html';
import rehypeFormat from 'rehype-format';

function wrapHtml(content: string, isDocumentationMode: boolean): string {
  let documentationString = `<meta name="template" content="documentation">`;
  return `\
<!DOCTYPE html>
<html>
  <head>
    <title></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="source" content="github">
    ${isDocumentationMode ? documentationString : ''}
  </head>
  <body>
    <header></header>
    <main>
${content
      .split('\n')
      .filter((line, i, arr) => (i !== 0 && i !== arr.length - 1) || !!line.trim())
      .map((line) => `        ${line}`).join('\n')}
    </main>
    <footer></footer>
  </body>
</html>`;
}

export default function stringify(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  rehypeFormat()(content.hast as any);

  // TODO : think about setting this in an intuitive way rather than
  // set to documetation mode unless its the root index file in the docs
  // which currently matches what gatsby does
  let documetationMode = ctx.attributes.content.path === '/src/pages/index.md' ? false : true;
  content.html = wrapHtml(toHtml(content.hast, {
    upperDoctype: true,
  }), documetationMode);
}
