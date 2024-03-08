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

export function stringify(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  rehypeFormat()(content.hast as any);

  content.html = toHtml(content.hast, {
    upperDoctype: true,
  });
}

export default function md2markup(ctx: Helix.UniversalContext) {
  toMdast(ctx);
  toHast(ctx);
  stringify(ctx);
  return ctx.attributes.content.html;
}
