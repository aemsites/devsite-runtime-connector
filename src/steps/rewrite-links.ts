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

// Private AdobeDocs orgs cannot use raw.githubusercontent.com; assets are served from the public site origin (see getResourceUrl in lib-adobeio.js).
export function isPrivateContentOrg(owner?: string): boolean {
  return Boolean(owner && owner.includes('AdobeDocsPrivate'));
}

export function devSiteConnectorUsePublicAssetUrls(): boolean {
  const v = process.env.DEVSITE_CONNECTOR_FLAG;
  return v === 'true' || v === '1';
}

// Public developer site origin (e.g. `https://developer-stage.adobe.com` OR `https://developer.adobe.com`)
export function devSiteConnectorPublicOrigin(): string | undefined {
  const o = process.env.DEVSITE_CONNECTOR_PUBLIC_ORIGIN?.trim();
  if (!o) {
    return undefined;
  }
  return o.replace(/\/$/, '');
}

/** Extensions for `<a href>` targets resolved like `<img src>` (raw GitHub / public origin / local). */
const REPO_ASSET_EXTENSIONS = new Set([
  '7z',
  'avif',
  'csv',
  'doc',
  'docx',
  'epub',
  'gif',
  'gz',
  'ico',
  'jpeg',
  'jpg',
  'json',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'pdf',
  'png',
  'ppt',
  'pptx',
  'rar',
  'svg',
  'tar',
  'tgz',
  'txt',
  'wasm',
  'wav',
  'webm',
  'webp',
  'xls',
  'xlsx',
  'xml',
  'yaml',
  'yml',
  'zip',
]);

/** Anchor-only: same file resolution as images (raw GitHub / public origin / local). */
function isRepoAssetExtension(resolvedPath: string): boolean {
  const lower = resolvedPath.replace(/\\/g, '/').split('#')[0].split('?')[0].toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.d.ts')) {
    return true;
  }
  const base = path.basename(lower);
  const lastDot = base.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === base.length - 1) {
    return false;
  }
  return REPO_ASSET_EXTENSIONS.has(base.slice(lastDot + 1));
}

const noopLog = { debug: (): void => {} };

export function resolve(ctx: Helix.UniversalContext, pathOrUrl: string, type: 'img' | 'a') {
  const log = ctx.log ?? noopLog;


  const content = ctx.attributes.content!;
  const {
    root,
    path: docPath,
    owner,
    repo,
    branch,
    pathprefix,
    localMode,
    origin,
  } = content;
  const usePublicAssetUrls = devSiteConnectorUsePublicAssetUrls();
  const publicOrigin = usePublicAssetUrls ? devSiteConnectorPublicOrigin() : undefined;

  // do not rewrite the links if it's an external link or an anchor link.
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://") || pathOrUrl.startsWith("#") || pathOrUrl.startsWith("mailto:")){
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith(pathprefix)) {
    return pathOrUrl;
  }

  log.debug('    rewrite pathOrUrl ' + pathOrUrl);

  let resolved: string;
  const projectRoot = '/src/pages/';

  // Handle absolute paths (starting with /) as relative to /src/pages/
  if (pathOrUrl.startsWith('/')) {
    resolved = path.resolve(projectRoot, pathOrUrl.substring(1));
  } else {
    // Handle relative paths
    const cwd = docPath.split('/').slice(0, -1).join('/');
    resolved = path.resolve(cwd, pathOrUrl);
  }

  const relativePath = path.relative(projectRoot, resolved).replaceAll('\\', '/');
  if (resolved.endsWith('.md') || resolved.includes(".md#")) {
    resolved = `${pathprefix}/${relativePath}`;
  } else if (type === 'img' || isRepoAssetExtension(resolved)) {
    const assetURL = `${projectRoot}${relativePath}`;

    let fetchAsset;
    //true local mode and not a deployment from a private site
    if (localMode && !usePublicAssetUrls) {
      const flatPath = assetURL.replace('/src/pages', '');
      fetchAsset = `${origin}${flatPath}`;
    } else if (isPrivateContentOrg(owner) && usePublicAssetUrls && pathprefix) {
      const prefix = pathprefix.startsWith('/') ? pathprefix : `/${pathprefix}`;
      fetchAsset = `${publicOrigin}${prefix}/${relativePath}`;
    } else {
      fetchAsset = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${assetURL}`;
    }
    resolved = fetchAsset;
    log.debug(`    resolved start: ${resolved}`);
  }

  if(resolved === path.resolve(root)) {
    resolved = `${pathprefix}`;
  } else if (resolved.startsWith(root)) {
    resolved = resolved.substring(root.length);
  }

  return resolved;
}

export default function rewriteLinks(ctx: Helix.UniversalContext) {
  const log = ctx.log ?? noopLog;
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
        } else if (getNodeProperties.includes('index.md')) {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a').replace("index.md", "");
        } else if (getNodeProperties.endsWith('.md')) {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a').slice(0, -3);
        } else if (getNodeProperties.includes(".md#")) {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a').replace(".md", "")
        }
        else {
          node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a');
        }
      }

      node.properties[attr] = resolve(ctx, node.properties[attr] as string, node.tagName as 'img' | 'a');

    }
    return CONTINUE;
  });
}
