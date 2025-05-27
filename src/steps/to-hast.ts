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
import { Code, Element } from 'mdast-util-to-hast/lib/handlers/code.js';

const customHandlers = {

  code(state: State, node: Code): Element | undefined {
    // Call the default handler for 'code' to get the standard <pre><code> structure.
    // This handles setting the 'language-xyz' class e.g. <pre><code class="language-xyz">
    const pre = defaultHandlers.code(state, node);

    // Parse the 'meta' string into a properties object.
    // This handles setting attributes e.g. <pre data-line="1-2, 5, 9-20"><code>
    const meta = node.meta ?? '';
    const keyValuePairs = Array.from(meta.matchAll(/(\S*)(\s*=\s*")(.*?)(")/g), (match) => [match[1], match[3]]);
    const metaProperties = Object.fromEntries(keyValuePairs);

    if (pre && pre.type === 'element' && pre.tagName === 'pre') {
      pre.properties = {
        ...pre.properties,
        ...metaProperties,
      };
    }

    return pre;
  },

  // No other handlers are defined here.
  // This means 'paragraph', 'heading', 'list', 'listItem', 'text', etc.,
  // will all be processed by `mdast-util-to-hast`'s built-in `defaultHandlers`.

};

export default function toHast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  content.hast = mdast2hast(content.mdast, {
    handlers: {
      ...customHandlers,
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
    },
    allowDangerousHtml: true,
  } as any);

  content.hast = raw(content.hast);
}
