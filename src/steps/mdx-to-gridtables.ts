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
import type { RootContent } from 'mdast';

function makeGridTableRow(child: RootContent): RootContent {
  return {
    type: 'gtRow',
    children: [
      {
        type: 'gtCell',
        children: [child],
      },
    ],
  } as unknown as RootContent;
}

export default function mdxToBlocks(ctx: Helix.UniversalContext) {
  const { content: { mdast } } = ctx.attributes;

  // for loop since we mutate in the loop
  for (let i = 0; i < mdast.children.length; i += 1) {
    const node = mdast.children[i];
    if (node.type !== 'mdxJsxFlowElement') {
      return;
    }

    // get slots
    const slotsAttr = node.attributes.find((attr) => (attr as { name: string }).name === 'slots');
    if (!slotsAttr || typeof slotsAttr.value !== 'string') {
      // TODO: throw error for invalid document
      break;
    }
    const slots = (slotsAttr.value).split(',');

    // get variants as string
    const variantAttr = node.attributes.find((attr) => (attr as { name: string }).name === 'variant');
    const variants = variantAttr?.value ? variantAttr.value as string : '';

    // block name is the JSX nodename
    const blockName = node.name;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    mdast.children.splice(i, 1 + slots.length, {
      type: 'gridTable',
      children: [
        {
          type: 'gtBody',
          children: [
            // first is the header, containing block name
            {
              type: 'paragraph',
              children: [
                {
                  type: 'strong',
                  children: [
                    {
                      type: 'text',
                      value: `${blockName} (${variants})`,
                    },
                  ],
                },
              ],
            },
            // remaining is the content from the slots
            // each slot is inserted as a separate row
            ...mdast.children
              .slice(i + 1, i + 1 + slots.length)]
            .map(makeGridTableRow),
        }],
    } as unknown as RootContent);
  }
}
