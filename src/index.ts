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

function getUrlExtension(url) {
  let extension;
  if (url.split('.').length > 1) {
    extension = url.split(/[#?]/)[0].split('.').pop().trim();
  }
  return extension;
}

// exported for dev server & tests
export async function run(req: Request, ctx: Helix.UniversalContext): Promise<Response> {
  const { log } = ctx;
  ctx.attributes ??= {};
  ctx.attributes.content ??= {};
  console.log('ctx.pathInfo', ctx.pathInfo);

  let extension = getUrlExtension(ctx.pathInfo.suffix);

  // TODO - figure out logic for tacking on md files always add on a trailing slash if no extension found
  // if(!extension) {
  //   ctx.pathInfo.suffix += '/';
  // }

  const suffixSplit = ctx.pathInfo.suffix.split('/');
  let suffixSplitRest = suffixSplit.slice(1);

  let devsitePathMatch;
  let devsitePathMatchFlag = false;

  console.log(`extension ${extension}`);

  // find match based on level 3, 2, or 1 transclusion rule
  // if match found in higher level don't do lower level
  if (suffixSplit.length > 2) {
    devsitePathMatch = devsitePaths.find((element) => element.pathPrefix === `/${suffixSplit[1]}/${suffixSplit[2]}/${suffixSplit[3]}`);
    devsitePathMatchFlag = !!devsitePathMatch;
    if (devsitePathMatchFlag) {
      console.log('rest 3');
      suffixSplitRest = suffixSplit.slice(4);
    }
  }
  if (suffixSplit.length > 1 && !devsitePathMatchFlag) {
    devsitePathMatch = devsitePaths.find((element) => element.pathPrefix === `/${suffixSplit[1]}/${suffixSplit[2]}`);
    devsitePathMatchFlag = !!devsitePathMatch;
    if (devsitePathMatchFlag) {
      console.log('rest 2');
      suffixSplitRest = suffixSplit.slice(3);
    }
  }
  if (suffixSplit.length > 0 && !devsitePathMatchFlag) {
    devsitePathMatch = devsitePaths.find((element) => element.pathPrefix === `/${suffixSplit[1]}`);
    devsitePathMatchFlag = !!devsitePathMatch;
    if (devsitePathMatchFlag) {
      console.log('rest 1');
      suffixSplitRest = suffixSplit.slice(2);
    }
  }

  // fix favicon to retrieve from adp-devsite repo
  if (ctx.pathInfo.suffix === '/favicon.ico') {
    devsitePathMatch = devsitePaths.find((element) => element.pathPrefix === '/');
  }

  console.log(`devsitePathMatch: ${devsitePathMatch?.pathPrefix}`);
  console.log(`suffixSplitRest: ${suffixSplitRest}`);

  // TODO: should this error out if no match is present?
  if (devsitePathMatch) {
    ctx.attributes.content.owner = devsitePathMatch.owner;
    ctx.attributes.content.repo = devsitePathMatch.repo;
    ctx.attributes.content.pathprefix = devsitePathMatch.pathPrefix;
    ctx.attributes.content.branch = devsitePathMatch.branch ? devsitePathMatch.branch : 'main';

    console.log(`ctx.attributes.content.branch: ${ctx.attributes.content.branch}`);
  }

  // const [_, repo, ...rest] = ctx.pathInfo.suffix.split('/');
  // if (!repo) {
  //   return new Response('', { status: 400, headers: { 'x-error': 'repo is required' } });
  // }

  const rootPath = devsitePathMatch?.root;
  let path = `${rootPath}${suffixSplitRest.join('/')}`.replaceAll('//', '/');

  if (path.endsWith('/')) {
    // impliclty grab index.md if it's a folder level
    path += 'index.md';
    extension = '.md';
  }
  // impliclty grab .md if there's no extension
  if (!extension) {
    path += '.md';
  }

  // const branch = path.split('/')[1];
  // const gatsbyConfigUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/eds/out/topNav.html`;
  // const topNavUrl = `https://raw.githubusercontent.com/${owner}/${repo}/preprocess-nav/eds/out/topNav.html`;
  // const sideNavUrl = `https://raw.githubusercontent.com/${owner}/${repo}/preprocess-nav/eds/out/sideNav.html`;

  ctx.attributes.content.root = rootPath;
  ctx.attributes.content.path = path;

  console.log(`path: ${path}`);
  console.log(`ctx.attributes.content.path: ${ctx.attributes.content.path}`);
  // ctx.attributes.content.topNavUrl = topNavUrl;
  // ctx.attributes.content.sideNavUrl = sideNavUrl;

  // TODO: need to determine which branch we want to pull from based on url
  // default to main
  const gitUrl = `https://raw.githubusercontent.com/${ctx.attributes.content.owner}/${ctx.attributes.content.repo}/${ctx.attributes.content.branch}${path}`;
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
  let html = md2markup(ctx);
  log.debug('html: ', html);

  html = html.replace(/https:\/\/youtu\.be\/([a-zA-Z0-9_-]+)(\?[^ ]*)?/g, (match, videoId, queryString) => {
    const embedUrl = `https://www.youtube.com/embed/${videoId}${queryString ? queryString : ''}`;

    return `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  });

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html',
    },
  });
}

/* eslint-disable */
export const main = (wrap as any)(createAdapter({ factory: () => run }));
