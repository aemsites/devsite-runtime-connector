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

/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { Helix } from '@adobe/helix-universal';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { dereference, remarkGfmNoLink } from '@adobe/helix-markdown-support';
import remarkGridTable from '@adobe/remark-gridtables';

import { toHast as mdast2hast, defaultHandlers, State } from 'mdast-util-to-hast';
import { raw } from 'hast-util-raw';
import { mdast2hastGridTablesHandler, TYPE_TABLE } from '@adobe/mdast-util-gridtables';

import { toHtml } from 'hast-util-to-html';
import rehypeFormat from 'rehype-format';

export function toMdast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;

  const converted = content.md.replace(/(\r\n|\n|\r)/gm, '\n');
  content.mdast = unified()
    .use(remarkParse)
    .use(remarkGfmNoLink)
    .use(remarkGridTable)
    .parse(converted);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  dereference(content.mdast);
}

export function splitSections(ctx: Helix.UniversalContext) {
  const { content: { mdast } } = ctx.attributes;

  // filter all children that are break blocks
  const dividers = mdast.children.filter((node) => node.type === 'thematicBreak')
    // then get their index in the list of children
    .map((node) => mdast.children.indexOf(node));

  // find pairwise permutations of spaces between blocks
  // include the very start and end of the document
  const starts = [0, ...dividers];
  const ends = [...dividers, mdast.children.length];

  // content.mdast.children = _.zip(starts, ends)
  mdast.children = starts.map((k, i) => [k, ends[i]])
    // but filter out empty section
    .filter(([start, end]) => start !== end)
    // then return all nodes that are in between
    .map(([start, end]) => {
      // skip 'thematicBreak' nodes
      const index = mdast.children[start].type === 'thematicBreak' ? start + 1 : start;
      return {
        type: 'section',
        children: mdast.children.slice(index, end),
      };
    });

  // unwrap sole section directly on the root
  if (mdast.children.length === 1 && mdast.children[0].type === 'section') {
    mdast.children = mdast.children[0].children;
  }
}

export function toHast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  content.hast = mdast2hast(content.mdast, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    handlers: {
      ...defaultHandlers,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      section: (state: State, node: any) => {
        const n = { ...node };
        const children = state.all(n);
        return {
          type: 'element',
          tagName: 'div',
          children,
        };
      },
      [TYPE_TABLE]: mdast2hastGridTablesHandler(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    allowDangerousHtml: true,
  });

  content.hast = raw(content.hast);
}

function wrapHtml(content: string): string {
  return `\
<!DOCTYPE html>
<html>
  <head>
    <title></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="/scripts/aem.js" type="module"></script>
    <script src="/scripts/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/styles/styles.css">
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

export function stringify(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  rehypeFormat()(content.hast as any);

  content.html = wrapHtml(toHtml(content.hast, {
    upperDoctype: true,
  }));
}

export default function md2markup(ctx: Helix.UniversalContext) {
  toMdast(ctx);
  splitSections(ctx);
  toHast(ctx);
  stringify(ctx);
  return ctx.attributes.content.html;
}
