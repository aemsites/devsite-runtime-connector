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

  let devsitePaths;
  let devsitePathsUrl;
  // retrieve the devsitepaths.json file based on if authorization is present
  if(req.headers.get('authorization')) {
    devsitePathsUrl = `https://main--adp-devsite-stage--adobedocs.aem.live/franklin_assets/devsitepaths.json`;
  } else {
    devsitePathsUrl = `https://main--adp-devsite--adobedocs.aem.live/franklin_assets/devsitepaths.json`;
  }

  await fetch(devsitePathsUrl)
  .then(function(response) {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Unable to fetch ${}');
    }
  }).then(function(data) {
    devsitePaths = data?.data;
  });

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

  // pull from specified branch described in the hacky x-content-source-authorization header
  // this allow us to deploy to main--adp-devsite-stage--adobedocs.hlx.page
  let branchHeader = req.headers.get('authorization');
  console.log(`branchHeader: ${branchHeader}`);
  // TODO: should this error out if no match is present?
  if (devsitePathMatch) {
    ctx.attributes.content.owner = devsitePathMatch.owner;
    ctx.attributes.content.repo = devsitePathMatch.repo;
    ctx.attributes.content.pathprefix = devsitePathMatch.pathPrefix;

    console.log(`branchHeader: ${branchHeader}`); 
    if(branchHeader) {
      ctx.attributes.content.branch = branchHeader;
    } else {
      ctx.attributes.content.branch = 'main';
    }
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

  console.log(`WEBSERVER_PORT ${process.env.WEBSERVER_PORT}`)
  const hostname = new URL(req.url).hostname;
  let origin;

  // set origin of content
  // local devmode: return content from http://127.0.0.1:3003
  // local dev: return content from github
  // normal: return content from github
  if(['127.0.0.1', 'localhost'].includes(hostname)) {
    // hacky way of getting the port since it's not in the req.url
    if(process?.env?.WEBSERVER_PORT && process.env.WEBSERVER_PORT==='3002') {
      origin = 'http://127.0.0.1:3003'
    } else {
      origin = 'https://raw.githubusercontent.com';
    }
  } else {
    origin = 'https://raw.githubusercontent.com';
  }

  let contentUrl;
  let localMode = false;
  // check to see if we're in local devmode or if content is coming from github
  if(origin === 'http://127.0.0.1:3003') {
    console.log('Local mode detected');
    localMode = true;
    let flatPath = path.replace('/src/pages', '');
    contentUrl = `${origin}${flatPath}`;
  } else {
    contentUrl = `${origin}/${ctx.attributes.content.owner}/${ctx.attributes.content.repo}/${ctx.attributes.content.branch}${path}`;
  }
  console.log(`contentUrl: ${contentUrl}`);
  const res = await fetch(contentUrl);
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

  const content = await res.text();

  if(localMode) {
    ctx.attributes.content.branch = res.headers.get('local-branch-name');
  }

  const resolvePath = (relativePath, currentDirectory) => {
    const baseDir = currentDirectory.substring(0, currentDirectory.lastIndexOf('/'));
  
    if (relativePath.startsWith('../')) {
      return baseDir.substring(0, baseDir.lastIndexOf('/')) + relativePath.slice(2);
    }
  
    if (relativePath.startsWith('./')) {
      return baseDir + relativePath.slice(1);
    }
  
    return baseDir + '/' + relativePath;
  };
  
  const fetchData = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from URL: ${url}`);
    }
    const text = await response.text();
    return text.replace(/^---[\s\S]*?---\s*/g, '').trim();
  };
  
  const replaceComponentWithFragment = async (content, componentName, pathName) => {
  
    if (pathName.endsWith('md')) {
      const resolvedPath = resolvePath(pathName, path);
      const rawUrl = `https://raw.githubusercontent.com/${ctx.attributes.content.owner}/${ctx.attributes.content.repo}/${ctx.attributes.content.branch}${resolvedPath}`;
  
      try {
        const fragment = await fetchData(rawUrl);
  
        if (!fragment) {
          return content;
        }
  
        const componentTag = `<${componentName}\\s*/?>`;
        return content.replace(new RegExp(componentTag, 'g'), fragment);
      } catch (error) {
        console.error('Error fetching data for', pathName, error);
        return content;
      }
    } else {
      console.log('Handling non-md path:', pathName);
      return content;
    }
  };
  
  const extractImportPaths = (content) => {
    return [...content.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)].map(match => ({
      componentName: match[1],
      pathName: match[2]
    }));
  };
  
    //credential jsonDefinition url update
    function updateCredentialTag(content: string, currentFilePath: string): string {
      return content.replace(/(<GetCredential[^>]*jsonDefinition=")([^"]+)("[^>]*\/>)/g, (match, before, oldPath, after) => {
        const newPath = resolvePath(oldPath, currentFilePath);
        return `${before}${newPath}${after}`;
      });
    }
    const importPaths = extractImportPaths(content);
    let updatedContent = content;
  
    for (const { componentName, pathName } of importPaths) {
      updatedContent = await replaceComponentWithFragment(updatedContent, componentName, pathName);
    }
    
    updatedContent = updateCredentialTag(updatedContent, path);
    
      ctx.attributes.content.md = updatedContent;

  // ctx.attributes.content.topNavContent = await topNavRes.text();
  // ctx.attributes.content.sideNavContent = await sideNavRes.text();

  // log.debug('topNavContent: ', ctx.attributes.content.topNavContent);
  // log.debug('sideNavContent: ', ctx.attributes.content.sideNavContent);
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
