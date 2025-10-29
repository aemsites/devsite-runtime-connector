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

  // Robustly extract attributes and flags for <code>
  const parseMeta = (input: string): Array<{ key: string; value?: string }> => {
    const tokens: Array<{ key: string; value?: string }> = [];
    let i = 0;
    const n = input.length;
    while (i < n) {
      while (i < n && /\s/.test(input[i]!)) i++;
      if (i >= n) break;
      const keyStart = i;
      while (i < n && !/\s|=/.test(input[i]!)) i++;
      const key = input.slice(keyStart, i);
      while (i < n && /\s/.test(input[i]!)) i++;
      let value: string | undefined;
      if (i < n && input[i] === '=') {
        i++;
        while (i < n && /\s/.test(input[i]!)) i++;
        if (i < n && input[i] === '"') {
          i++;
          const valStart = i;
          while (i < n && input[i] !== '"') i++;
          value = input.slice(valStart, i);
          if (i < n && input[i] === '"') i++;
        } else {
          const valStart = i;
          while (i < n && !/\s/.test(input[i]!)) i++;
          value = input.slice(valStart, i);
        }
      }
      if (key) tokens.push({ key, value });
    }
    return tokens;
  };

  for (const { key, value } of parseMeta(meta)) {
    if (key === 'disableLineNumbers' && value === undefined) {
      codeClasses.push('disableLineNumbers');
    } else if (key.startsWith('language-') && value === undefined) {
      codeClasses.push(key);
    } else if (value !== undefined) {
      codeAttrs[key] = value;
    } else {
      codeAttrs[key] = '';
    }
  }

  if (pre?.type === 'element' && pre.tagName === 'pre') {
    // Add classes and attributes to <code> child only
    const isCodeElement = (n: any): n is Element => n?.type === 'element' && n.tagName === 'code';
    const codeEl = pre.children?.find?.(isCodeElement);
    if (codeEl) {
      // Merge classes
      const existing = (codeEl.properties as any).className;
      const base: Array<string | number> = Array.isArray(existing)
        ? (existing as any[]).filter((v) => typeof v === 'string' || typeof v === 'number')
        : typeof existing === 'string' || typeof existing === 'number'
          ? [existing]
          : [];
      const allClasses: Array<string | number> = Array.from(new Set([...base, ...codeClasses]));
      if (allClasses.length) (codeEl.properties as any).className = allClasses;
      else delete (codeEl.properties as any).className;

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
