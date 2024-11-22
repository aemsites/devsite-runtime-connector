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
import type { MdxJsxFlowElement, MdxJsxAttribute, MdxJsxExpressionAttribute } from 'mdast-util-mdx-jsx';
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

function getAttribute(node: MdxJsxFlowElement, name: string) {
  return node.attributes.find((attr) => (attr as { name: string }).name === name);
}

function getAttributeValue(attr: MdxJsxAttribute | MdxJsxExpressionAttribute, fallback?: string) {
  return attr && attr.value && typeof attr.value === 'string' ? attr.value : fallback;
}

export default function mdxToBlocks(ctx: Helix.UniversalContext) {
  const { content: { mdast } } = ctx.attributes;

  // for loop since we mutate in the loop
  for (let i = 0; i < mdast.children.length; i += 1) {
    const node = mdast.children[i];
    if (node.type !== 'mdxJsxFlowElement') {
      // eslint-disable-next-line no-continue
      continue;
    }

    // get slots
    const slotsAttr = getAttribute(node, 'slots');
    const slotsValue = getAttributeValue(slotsAttr, '');
    // if (!slotsValue) {
    //   // TODO: throw error for invalid document
    //   break;
    // }
    const slots = slotsValue.split(',');

    // repeat the block N times if repeat="N" is set
    const repeatAttr = getAttribute(node, 'repeat');
    const repeat = parseInt(getAttributeValue(repeatAttr, '1'), 10);

    // get variants as string
    const variantAttr = getAttribute(node, 'variant');
    const variants = getAttributeValue(variantAttr, '');

    // block name is the JSX nodename
    const blockName = node.name;

    let slotsToInsert: RootContent[];
    if (blockName === 'RedoclyAPIBlock') {
      slotsToInsert = node.attributes
        .filter((attribute): attribute is MdxJsxAttribute => attribute != null)
        .map((attribute) => {
          const value = typeof attribute.value === 'string' ? attribute.value : attribute.value?.value;
          return { type: 'code', value: `data-${attribute.name}=${value}` };
        });
    } else {
      const totalRows = repeat * slots.length;
      slotsToInsert = mdast.children.slice(i + 1, i + 1 + totalRows);
      if (slotsToInsert.length !== totalRows) {
        // TODO: throw error for invalid slots?
      }
    }

    mdast.children.splice(i, 1 + slotsToInsert.length, {
      type: 'gridTable',
      children: [{
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
          ...slotsToInsert,
        ].map(makeGridTableRow),
      }],
    } as unknown as RootContent);
  }
}
