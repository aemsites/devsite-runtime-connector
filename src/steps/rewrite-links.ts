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

import { CONTINUE, visit } from 'unist-util-visit';
import path from 'path';
import type { Helix } from '@adobe/helix-universal';

function resolve(ctx: Helix.UniversalContext, pathOrUrl: string) {
  if (!pathOrUrl.startsWith('./') && !pathOrUrl.startsWith('../')) {
    return pathOrUrl;
  }

  const {
    root,
    path: docPath,
  } = ctx.attributes.content;

  const cwd = docPath.split('/').slice(0, -1).join('/');
  let resolved = path.resolve(cwd, pathOrUrl);
  if (resolved.endsWith('.md')) {
    resolved = resolved.slice(0, -3);
  }
  return resolved.startsWith(root) ? resolved.substring(root.length) : resolved;
}

export default function rewriteLinks(ctx: Helix.UniversalContext) {
  const { attributes: { content: { hast } } } = ctx;

  const els = {
    a: 'href',
    img: 'src',
  };

  visit(hast, (node) => {
    if (node.type !== 'element') {
      return CONTINUE;
    }
    const attr = els[node.tagName];
    if (attr) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      node.properties[attr] = resolve(ctx, node.properties[attr] as string);
    }
    return CONTINUE;
  });
}
