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

function resolve(ctx: Helix.UniversalContext, pathOrUrl: string, type: 'img' | 'a') {
  if (!pathOrUrl.startsWith('./') && !pathOrUrl.startsWith('../') && !pathOrUrl.startsWith('/')) {
    return pathOrUrl;
  }

  const {
    root,
    path: docPath,
    owner,
    repo,
  } = ctx.attributes.content;

  const cwd = docPath.split('/').slice(0, -1).join('/');

  let resolved = path.resolve(cwd, pathOrUrl.startsWith('/') ? `.${pathOrUrl}` : pathOrUrl);
  if (resolved.endsWith('.md')) {
    resolved = resolved.slice(0, -3);
  } else if (type === 'img') {
    // use absolute paths for images, since they will be replaced with mediabus paths once ingested
    if (!resolved.startsWith('/')) {
      resolved = resolved.startsWith('./') ? resolved.substring(1) : `/${resolved}`;
    }
    // TODO: parameterize the runtime prefix, not sure where it's set in helix-universal
    resolved = `/api/v1/web/md2markup/main/${owner}/${repo}${resolved}`;
  }

  resolved = resolved.startsWith(root) ? resolved.substring(root.length) : resolved;
  return resolved;
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
      node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a');
    }
    return CONTINUE;
  });
}
