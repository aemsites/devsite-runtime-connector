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
import { resolve } from './rewrite-links.js';

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
  if (attr && attr.value) {
    return typeof attr.value === 'string' ? attr.value : attr.value.value;
  }
  return fallback;
}

// Type guard to filter only MdxJsxAttribute objects
function isMdxJsxAttribute(attribute: MdxJsxAttribute| MdxJsxExpressionAttribute)
: attribute is MdxJsxAttribute {
  return attribute != null;
}

export default function mdxToBlocks(ctx: Helix.UniversalContext) {
  const { content: { mdast } } = ctx.attributes;
  const ATTRIBUTE_PREFIX = 'data-';

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

    // Process attributes into individual rows
    const attributeRows = (node.attributes || [])
    .filter(isMdxJsxAttribute)
    .map((attribute) => ({
      type: 'gtRow',
      children: [
        {
          type: 'gtCell',
          children: [
            {
              type: 'code',
              value: `${ATTRIBUTE_PREFIX}${attribute.name}=${getAttributeValue(attribute, '')}`,
            },
          ],
        },
      ],
    }));

    const totalRows = repeat * slots.length;
    let slotsToInsert = mdast.children.slice(i + 1, i + 1 + totalRows);

    if (node.name === 'Embed') { // This is for embedding local videos
      slotsToInsert = slotsToInsert.map((val) => {
        const valWithChildren = val as { children: Array<any> };
        if (valWithChildren.children) {
          valWithChildren.children = valWithChildren.children.map((data) => {
            const updatedValue = resolve(ctx, data.value, 'img');
            return { ...data, value: updatedValue };
          });
        }
        return val;
      });
    }

    mdast.children.splice(i, 1 + slotsToInsert.length, {
      type: 'gridTable',
      children: [
        {
          type: 'gtBody',
          children: [
            // Add block name as a header row
            makeGridTableRow({
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
            }),
            // Add attribute rows
            ...(attributeRows.length > 0 ? attributeRows : []),
            // Add content from the slots
            ...slotsToInsert.map(makeGridTableRow),
          ],
        },
      ],
    } as unknown as RootContent);
  }
}
