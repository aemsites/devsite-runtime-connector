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

import type { Helix } from '@adobe/helix-universal';
import wrap from '@adobe/helix-shared-wrap';
import { Request, Response } from '@adobe/fetch';
// eslint-disable-next-line
import { createAdapter } from '../node_modules/@adobe/helix-universal/src/openwhisk-adapter.js';
import md2markup from './md2markup.js';

// test urls
// http://localhost:3000/AdobeDocs/commerce-webapi/rest/b2b/company-users.md?root=main/src/pages
// https://53444-842orangechinchilla.adobeioruntime.net/api/v1/web/md2markup/main/AdobeDocs/commerce-webapi/rest/b2b/company-users.md?root=/main/src/pages

// exported for dev server & tests
export async function run(req: Request, ctx: Helix.UniversalContext): Promise<Response> {
  const { log } = ctx;
  ctx.attributes ??= {};
  ctx.attributes.content ??= {};
  const [_, owner, repo, ...rest] = ctx.pathInfo.suffix.split('/');
  if (!owner || !repo) {
    return new Response('', { status: 400, headers: { 'x-error': 'owner and repo are required' } });
  }
  ctx.attributes.content.owner = owner;
  ctx.attributes.content.repo = repo;

  const url = new URL(req.url);
  let rootPath = url.searchParams.has('root') ? url.searchParams.get('root') : '/';
  if (!rootPath.endsWith('/')) {
    rootPath += '/';
  }
  if (!rootPath.startsWith('/')) {
    rootPath = `/${rootPath}`;
  }
  let path = `${rootPath}${rest.join('/')}`.replaceAll('//', '/');
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  ctx.attributes.content.root = rootPath;
  ctx.attributes.content.path = path;
  const gitUrl = `https://raw.githubusercontent.com/${owner}/${repo}${path}`;
  log.debug('gitUrl: ', gitUrl);

  const res = await fetch(gitUrl);
  if (!res.ok) {
    const status = res.status < 500 ? res.status : 500;
    return new Response('', {
      status,
      headers: {
        'x-error': `failed to fetch from github (${res.status})`,
      },
    });
  }

  if (!path.endsWith('.md')) {
    // dont convert non-markdown content
    return new Response(await res.arrayBuffer(), {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type'),
      },
    });
  }

  ctx.attributes.content.md = await res.text();
  const html = md2markup(ctx);
  log.debug('html: ', html);
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html',
    },
  });
}

/* eslint-disable */
export const main = (wrap as any)(createAdapter({ factory: () => run }));
