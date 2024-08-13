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
import devsitePaths from './devsite-paths.json' assert { type: 'json' };

// test urls
// http://localhost:3000/AdobeDocs/commerce-webapi/rest/b2b/company-users.md?root=main/src/pages
// https://53444-842orangechinchilla.adobeioruntime.net/api/v1/web/md2markup/main/AdobeDocs/commerce-webapi/rest/b2b/company-users.md?root=/main/src/pages

// exported for dev server & tests
export async function run(req: Request, ctx: Helix.UniversalContext): Promise<Response> {
  const { log } = ctx;
  ctx.attributes ??= {};
  ctx.attributes.content ??= {};
  console.log('ctx.pathInfo', ctx.pathInfo);

  const [_, repo, ...rest] = ctx.pathInfo.suffix.split('/');
  if (!repo) {
    return new Response('', { status: 400, headers: { 'x-error': 'repo is required' } });
  }

  const owner = devsitePaths[repo]?.owner;
  ctx.attributes.content.owner = owner;
  ctx.attributes.content.repo = repo;

  console.log(`owner: ${owner}`);
  console.log(`repo: ${repo}`);

  // const url = new URL(req.url);

  let rootPath = devsitePaths[repo]?.root;
  let path = `${rootPath}${rest.join('/')}`.replaceAll('//', '/');

  // const branch = path.split('/')[1];
  // const gatsbyConfigUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/eds/out/topNav.html`;
  // const topNavUrl = `https://raw.githubusercontent.com/${owner}/${repo}/preprocess-nav/eds/out/topNav.html`;
  // const sideNavUrl = `https://raw.githubusercontent.com/${owner}/${repo}/preprocess-nav/eds/out/sideNav.html`;

  console.log(`path: ${path}`);
  console.log(`ctx.attributes.content.path: ${ctx.attributes.content.path}`);
  ctx.attributes.content.root = rootPath;
  ctx.attributes.content.path = path;

  // ctx.attributes.content.topNavUrl = topNavUrl;
  // ctx.attributes.content.sideNavUrl = sideNavUrl;

  // TODO: need to determine which branch we want to pull from based on url
  // default to main
  const gitUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main${path}`;
  console.log(`gitUrl: ${gitUrl}`);
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

  // const topNavRes = await fetch(topNavUrl);
  // if (!topNavRes.ok) {
  //   const status = topNavRes.status < 500 ? topNavRes.status : 500;
  //   return new Response('', {
  //     status,
  //     headers: {
  //       'x-error': `failed to fetch from github (${topNavRes.status})`,
  //     },
  //   });
  // }

  // const sideNavRes = await fetch(sideNavUrl);
  // if (!sideNavRes.ok) {
  //   const status = sideNavRes.status < 500 ? sideNavRes.status : 500;
  //   return new Response('', {
  //     status,
  //     headers: {
  //       'x-error': `failed to fetch from github (${sideNavRes.status})`,
  //     },
  //   });
  // }

  log.debug('file name: ', ctx.attributes);
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
  // ctx.attributes.content.topNavContent = await topNavRes.text();
  // ctx.attributes.content.sideNavContent = await sideNavRes.text();

  // log.debug('topNavContent: ', ctx.attributes.content.topNavContent);
  // log.debug('sideNavContent: ', ctx.attributes.content.sideNavContent);
  const html = md2markup(ctx);
  // log.debug('html: ', html);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html',
    },
  });
}

/* eslint-disable */
export const main = (wrap as any)(createAdapter({ factory: () => run }));
