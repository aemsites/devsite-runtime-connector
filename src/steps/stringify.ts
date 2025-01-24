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

function wrapHtml(
  content: string,
  pathprefix: string,
  githubBlobPath: string,
  isDocumentationMode: boolean,
  hideBreadcrumbNav?: string,
): string {
  const documentationString = '<meta name="template" content="documentation">';
  return `\
<!DOCTYPE html>
<html>
  <head>
    <title></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="source" content="github">
    <meta name="pathprefix" content="${pathprefix}">
    <meta name="githubblobpath" content="${githubBlobPath}">
    ${isDocumentationMode ? documentationString : ''}
    ${hideBreadcrumbNav ? `<meta name="hidebreadcrumbnav" content="${hideBreadcrumbNav}">` : ''}
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

function parseFrontMatter(md: string) {
  const tag = '---';
  const startIndex = md.indexOf(tag) + tag.length + 1;
  const endIndex = md.indexOf(tag, startIndex);
  return md.substring(startIndex, endIndex + tag.length - startIndex);
}

function parseHideBreadcrumbNav(md: string) {
  const frontMatter = parseFrontMatter(md);
  const lines = frontMatter.split('\n');
  const line = lines.find((l) => l.trim().startsWith('hideBreadcrumbNav:'));

  let hideBreadcrumbNav: string | null = null;
  if (line) {
    const tokens = line.split(':');
    if (tokens.length === 2) {
      hideBreadcrumbNav = tokens[1].trim();
    }
  }

  return hideBreadcrumbNav;
}

export default function stringify(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  rehypeFormat()(content.hast as any);

  // TODO : think about setting this in an intuitive way rather than
  // set to documetation mode unless its the root index file in the docs
  // which currently matches what gatsby does
  const documetationMode = ctx.attributes.content.path !== '/src/pages/index.md';
  const { pathprefix } = ctx.attributes.content;
  const githubBlobPath = `https://github.com/${ctx.attributes.content.owner}/${ctx.attributes.content.repo}/blob/${ctx.attributes.content.branch}${ctx.attributes.content.path}`;
  const hideBreadcrumbNav = parseHideBreadcrumbNav(ctx.attributes.content.md);
  content.html = wrapHtml(toHtml(content.hast, {
    upperDoctype: true,
  }), pathprefix, githubBlobPath, documetationMode, hideBreadcrumbNav);
}
