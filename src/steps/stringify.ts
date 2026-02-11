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
  hideEditInGitHub?: string,
  hideLogIssue?: string,
  hideCopyMarkdown?: string,
  layout?: string,
  title?: string,
  description?: string,
  searchKeywords? : string,
): string {
  const documentationString = '<meta name="template" content="documentation">';
  return `\
<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    ${description ? `<meta name="description" content="${description}">` : ''}
    ${searchKeywords ? `<meta name="keywords" content="${searchKeywords}">` : ''}
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="source" content="github">
    <meta name="pathprefix" content="${pathprefix}">
    <meta name="githubblobpath" content="${githubBlobPath}">
    ${isDocumentationMode ? documentationString : ''}
    ${hideBreadcrumbNav ? `<meta name="hidebreadcrumbnav" content="${hideBreadcrumbNav}">` : ''}
    ${hideEditInGitHub ? `<meta name="hideeditingithub" content="${hideEditInGitHub}">` : ''}
    ${hideLogIssue ? `<meta name="hidelogissue" content="${hideLogIssue}">` : ''}
    ${hideCopyMarkdown ? `<meta name="hidecopymarkdown" content="${hideCopyMarkdown}">` : ''}
    ${layout ? `<meta name="layout" content="${layout}">` : ''}
  </head>
  <body>
    <header></header>
    <main>
${content
      .split('\n')
      .filter((line, i, arr) => (i !== 0 && i !== arr.length - 1) || !!line.trim())
      .join('\n')}
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

function parseVariable(md: string, keyword, log) {
  const frontMatter = parseFrontMatter(md);
  const lines = frontMatter.split('\n');
  const line = lines.find((l) => l.trim().startsWith(keyword));
  log.debug(`    parseVariable ${keyword} line: ${line}`);
  let variable: string = '';

  if (line) {
    const tokens = line.split(':');
    if (tokens.length === 2) {
      const value = tokens[1].trim();
      
      // Handle YAML array for keywords
      if (value === '' && keyword === 'keywords:') {
        const startIndex = lines.indexOf(line);
        const keywordLines = lines
          .slice(startIndex + 1)
          .map(l => l.trim())
          .filter(l => l.startsWith('-'))
          .map(l => l.substring(1).trim())
          .filter(l => l.length > 0);
        
        if (keywordLines.length > 0) {
          variable = keywordLines.join(', ');
          log.debug('    Parsed keywords:', variable);
        }
      } else {
        variable = value;
      }
    }
  }

  return variable;
}

export default function stringify(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  const { log } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  rehypeFormat()(content.hast as any);

  // TODO : think about setting this in an intuitive way rather than
  // set to documetation mode unless its the root index file in the docs
  // which currently matches what gatsby does
  const documetationMode = ctx.attributes.content.path !== '/src/pages/index.md';
  const { pathprefix } = ctx.attributes.content;
  const githubBlobPath = `https://github.com/${ctx.attributes.content.owner}/${ctx.attributes.content.repo}/blob/${ctx.attributes.content.branch}${ctx.attributes.content.path}`;
  const hideBreadcrumbNav = parseVariable(ctx.attributes.content.md, "hideBreadcrumbNav:", log);
  const hideEditInGitHub = parseVariable(ctx.attributes.content.md, "hideEditInGitHub:", log);
  const hideLogIssue = parseVariable(ctx.attributes.content.md, "hideLogIssue:", log);
  const hideCopyMarkdown = parseVariable(ctx.attributes.content.md, "hideCopyMarkdown:", log);
  const layout = parseVariable(ctx.attributes.content.md, "layout:", log);
  const docTitle = parseVariable(ctx.attributes.content.md, "title:", log);
  const docDescription = parseVariable(ctx.attributes.content.md, "description:", log);
  const searchKeywords = parseVariable(ctx.attributes.content.md, "keywords:", log);
  content.html = wrapHtml(toHtml(content.hast, {
    upperDoctype: true,
  }), pathprefix, githubBlobPath, documetationMode, hideBreadcrumbNav, hideEditInGitHub, hideLogIssue, hideCopyMarkdown, layout, docTitle, docDescription, searchKeywords);
}
