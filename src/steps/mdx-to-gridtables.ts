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

function makeGridTableRow(cells: RootContent[]): RootContent {
  return {
    type: 'gtRow',
    children: cells.map((cell) => (
      {
        type: 'gtCell',
        children: [cell],
      }
    )),
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

function listToMatrix<T>(list: T[], width: number): T[][] {
  const matrix: T[][] = [];

  for (let i = 0, k = -1; i < list.length; i += 1) {
      if (i % width === 0) {
          k += 1;
          matrix[k] = [];
      }
      matrix[k].push(list[i]);
  }

  return matrix;
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

    const totalSlots = repeat * slots.length;
    let slotsToInsert = mdast.children.slice(i + 1, i + 1 + totalSlots);

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

    if (node.name === 'GetCredential') {
      function processAttributes(attributes: any[]): Record<string, string> {
        return (attributes || []).reduce((acc: Record<string, string>, attr: any) => {
          if (attr?.name) {
            let value = getAttributeValue(attr, '');
            if (attr.name === 'icon') {
              const buildImagePath = resolve(ctx, value, 'img');
              acc[attr.name] = buildImagePath;
            } else {
              acc[attr.name] = value;
            }
          }
          return acc;
        }, {});
      }
    
      // Recursive function to process children and construct the JSON structure
      function processChildrenAsJson(children: any[]): any[] {
        return (children || [])
          .map((child) => {
            switch (child.type) {
              case 'mdxJsxFlowElement':
                return {
                  name: child.name,
                  attributes: processAttributes(child.attributes || []),
                  children: processChildrenAsJson(child.children || []),
                };
              case 'paragraph': {
                const linkContent = child.children
                  ?.map((c: any) => {
                    if (c.type === 'link') {
                      const href = c.url || '';
                      const text = c.children
                        ?.map((linkChild: any) =>
                          linkChild.type === 'text' ? linkChild.value : ''
                        )
                        .join('');
                      return `[${text}](${href})`;
                    }
                    return '';
                  })
                  .join('');
                if (linkContent) {
                  return {
                    type: 'link',
                    content: linkContent,
                    href: child.children?.[0]?.url || '',
                  };
                }
                const paragraphContent = child.children
                  ?.map((c: any) => (c.type === 'text' ? c.value : ''))
                  .join('');
                return paragraphContent
                  ? { type: 'paragraph', content: paragraphContent }
                  : null;
              }
              case 'link':
                return {
                  type: 'link',
                  content: child.children
                    ?.map((c: any) => (c.type === 'text' ? c.value : ''))
                    .join('') || '',
                  href: child.url || '',
                };
              case 'heading':
                return {
                  type: `heading-${child.depth || 1}`,
                  content:
                    child.children
                      ?.map((c: any) => (c.type === 'text' ? c.value : ''))
                      .join('') || '',
                };
              case 'text':
                return { type: 'text', content: child.value || '' };
              default:
                return null;
            }
          })
          .filter(Boolean); 
      }
    
      const getCredentialJson = {
        name: node.name,
        attributes: processAttributes(node.attributes || []),
        children: processChildrenAsJson(node.children || []),
      };

      slotsToInsert = [
        {
          type: 'code',
          value: JSON.stringify(getCredentialJson, null, 2),
        },
        ...slotsToInsert,
      ];
    } 

    const rowsToInsert = listToMatrix(slotsToInsert, slots.length);

    mdast.children.splice(i, 1 + totalSlots, {
      type: 'gridTable',
      children: [
        {
          type: 'gtBody',
          children: [
            // Add block name as a header row
            makeGridTableRow([{
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
            }]),
            // Add attribute rows
            ...(attributeRows.length > 0 ? attributeRows : []),
            // Add content from the slots
            ...rowsToInsert.map(makeGridTableRow),
          ],
        },
      ],
    } as unknown as RootContent);
  }
}
