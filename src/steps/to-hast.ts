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
import { toString } from 'hast-util-to-string';

/**
 * Converts text to a URL-friendly slug for use as heading IDs.
 * @param text - The heading text to convert
 * @returns A lowercase, hyphenated slug
 */
function textToSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '')            // Remove leading hyphens
    .replace(/-+$/, '');           // Remove trailing hyphens
}

/**
 * Creates a custom heading handler that generates IDs for anchor links.
 * @param depth - The heading level (1-6)
 * @returns A handler function for the heading
 */
function createHeadingHandler(depth: number) {
  return (state: State, node: any) => {
    const children = state.all(node);
    const result = {
      type: 'element' as const,
      tagName: `h${depth}`,
      properties: {} as Record<string, string>,
      children,
    };

    // Generate ID from heading text content
    const textContent = toString(result);
    if (textContent) {
      result.properties.id = textToSlug(textContent);
    }

    return result;
  };
}

export default function toHast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  content.hast = mdast2hast(content.mdast, {
    handlers: {
      ...defaultHandlers,
      heading: (state: State, node: any) => {
        return createHeadingHandler(node.depth)(state, node);
      },
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
