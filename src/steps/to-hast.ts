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
import type { Code } from 'mdast-util-to-hast/lib/handlers/code.js';
import type { Element } from 'hast';

export function code(state: State, node: Code): any {
  const pre = defaultHandlers.code(state, node);
  const meta = (node.meta ?? '').trim();

  const codeAttrs: Record<string, string> = {};
  const codeClasses: string[] = [];

  const parseMeta = (input: string): Array<{ key: string; value?: string }> => {
    const regex = /([^\s=]+)(?:=(?:"([^"]*)"|([^\s"]+)))?/g;
    const tokens: Array<{ key: string; value?: string }> = [];

    let match;
    while ((match = regex.exec(input)) !== null) {
      const key = match[1];
      const value = match[2] ?? match[3];
      tokens.push({ key, value });
    }

    return tokens;
  };

  // Normalize boolean-like flags so JSX styles like `flag` and `flag={true}` are treated the same
  for (const { key, value } of parseMeta(meta)) {
    const isBooleanTrue = value === undefined || value === 'true';
    if ((key === 'disableLineNumbers' || key.startsWith('language-')) && isBooleanTrue) {
      codeClasses.push(key);
    } else {
      codeAttrs[key] = value ?? '';
    }
  }

  if (pre?.type === 'element' && pre.tagName === 'pre') {
    const isCodeElement = (n: any): n is Element => n?.type === 'element' && n.tagName === 'code';
    const codeEl = pre.children?.find?.(isCodeElement);

    if (codeEl) {
      if (codeClasses.length) {
        const existingArray = [].concat(codeEl.properties?.className || []);
        codeEl.properties.className = [...existingArray, ...codeClasses];
      }

      // Merge attributes
      Object.assign(codeEl.properties, codeAttrs);
    }
  }

  return pre;
}

export default function toHast(ctx: Helix.UniversalContext) {
  const { content } = ctx.attributes;
  content.hast = mdast2hast(content.mdast, {
    handlers: {
      ...defaultHandlers,
      code,
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
