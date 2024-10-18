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
  const { log } = ctx;


  const {
    root,
    path: docPath,
    owner,
    repo,
    branch,
    pathprefix
  } = ctx.attributes.content;

  if (!pathOrUrl.startsWith('./') && !pathOrUrl.startsWith('../') && !pathOrUrl.startsWith('/')) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith(pathprefix)) {
    return pathOrUrl;
  }

  log.debug('rewrite')
  const cwd = docPath.split('/').slice(0, -1).join('/');

  let resolved = path.resolve(cwd, pathOrUrl.startsWith('/') ? `.${pathOrUrl}` : pathOrUrl);

  const projectRoot = '/src/pages/';
  const relativePath = path.relative(projectRoot, resolved).replaceAll('\\', '/');
  if (resolved.endsWith('.md') || resolved.includes(".md#")) {
    // resolved = resolved.slice(0, -3);
    resolved = `${pathprefix}/${relativePath}`;
  } else if (type === 'img') {
    // use this image URL
    const imageURL = `${projectRoot}${relativePath}`;

    const fetchImage = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${imageURL}`;
    resolved = fetchImage;
    // use absolute paths for images, since they will be replaced with mediabus paths once ingested
    // TODO: fix resolved paths for images
    log.debug(`resolved start: ${resolved}`);
    // if (!resolved.startsWith('/')) {
    //   resolved = resolved.startsWith('./') ? resolved.substring(1) : `/${resolved}`;
    // }
    resolved = `${resolved}`;
  }

  resolved = resolved.startsWith(root) ? resolved.substring(root.length) : resolved;
  log.debug(`resolved final: ${resolved}`);
  return resolved;
}

export default function rewriteLinks(ctx: Helix.UniversalContext) {
  const { log } = ctx;
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

      const getNodeProperties = node.properties[attr].toString();
      if (attr === "href") {
        if (getNodeProperties.endsWith('index.md')) {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a').replace("index.md", "");
        }
        else if (getNodeProperties.endsWith('md')) {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a').slice(0, -3);
        } else if (getNodeProperties.includes(".md#")) {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a').replace(".md", "")
        }
        else {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a');
        }
      }

      log.debug('visit');
      node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a');
      log.debug(`${attr} visited`);

    }
    return CONTINUE;
  });
}
