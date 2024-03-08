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

// exported for dev server
export async function run(req: Request, ctx: Helix.UniversalContext): Promise<Response> {
  const { log } = ctx;
  ctx.attributes ??= {};
  ctx.attributes.content ??= {};
  const [_, owner, repo, ...rest] = ctx.pathInfo.suffix.split('/');
  if (!owner || !repo) {
    return new Response('', { status: 400, headers: { 'x-error': 'owner and repo are required' } });
  }

  const url = new URL(req.url);
  let rootPath = url.searchParams.has('root') ? url.searchParams.get('root') : '/';
  if (!rootPath.endsWith('/')) {
    rootPath += '/';
  }
  if (!rootPath.startsWith('/')) {
    rootPath = `/${rootPath}`;
  }
  const path = `${rootPath}${rest.join('/')}`.replaceAll('//', '/');
  const mdUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main${path.startsWith('/') ? '' : '/'}${path}`;
  log.debug('mdUrl: ', mdUrl);

  const res = await fetch(mdUrl);
  if (!res.ok) {
    const status = res.status < 500 ? res.status : 500;
    return new Response('', { status, headers: { 'x-error': `failed to fetch markdown (${res.status})` } });
  }

  ctx.attributes.content.md = await res.text();
  const html = md2markup(ctx);
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

// eslint-disable-next-line
export const main = (wrap as any)(createAdapter({ factory: () => run }));
