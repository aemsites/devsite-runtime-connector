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

/* eslint-disable @typescript-eslint/no-unsafe-argument,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-assignment */

import { Helix } from '@adobe/helix-universal';
import { toHast as mdast2hast, defaultHandlers, State } from 'mdast-util-to-hast';
import { raw } from 'hast-util-raw';
import { mdast2hastGridTablesHandler, TYPE_TABLE } from '@adobe/mdast-util-gridtables';

// Parses js{try id=foo} into ['language-js', 'try', 'id=foo']
function getCodeClasses(lang: string | null, meta: string | null): string[] {
  const [, language, extra] = lang?.match(/^([^{]*)(.*)$/) || [];
  const fullMeta = ((extra || '') + ' ' + (meta || '')).replace(/[{}]/g, '').trim();
  return [...(language ? [`language-${language}`] : []), ...fullMeta.split(/\s+/).filter(Boolean)];
}

export default function toHast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  content.hast = mdast2hast(content.mdast, {
    handlers: {
      ...defaultHandlers,
      section: (state: State, node: any) => ({
        type: 'element',
        tagName: 'div',
        children: state.all({ ...node }),
      }),
      code: (_state: State, node: any) => {
        const classes = getCodeClasses(node.lang, node.meta);
        return {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [{
            type: 'element',
            tagName: 'code',
            properties: classes.length ? { className: classes } : {},
            children: [{ type: 'text', value: node.value || '' }],
          }],
        };
      },
      [TYPE_TABLE]: mdast2hastGridTablesHandler(),
    },
    allowDangerousHtml: true,
  } as any);

  content.hast = raw(content.hast);
}
