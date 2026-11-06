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

/* eslint-disable no-await-in-loop, no-continue */

import { h } from 'hastscript';
import { selectAll, select } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import { parse } from 'yaml';
import type { Element } from 'hast';
import type { Helix } from '@adobe/helix-universal';
import type { ReadableStream } from 'node:stream/web';
import { isPrivateContentOrg, devSiteConnectorPublicOrigin } from './rewrite-links.js';

const MAX_SPEC_BYTES = 2 * 1024 * 1024;
const MAX_OPENAPI_DOCUMENTS = 20;
const REQUEST_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 15_000;

type OpenApiObject = Record<string, unknown>;
type Fetcher = typeof fetch;
type FetchBudget = {
  deadline: number;
  documentCount: number;
};

function isObject(value: unknown): value is OpenApiObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAllowedOrigin(ctx: Helix.UniversalContext): string | undefined {
  const { content } = ctx.attributes;
  if (content.localMode && content.origin) {
    return content.origin;
  }
  if (isPrivateContentOrg(content.owner)) {
    return devSiteConnectorPublicOrigin();
  }
  return undefined;
}

function resolveSpecUrl(ctx: Helix.UniversalContext, src: string): URL {
  const { content } = ctx.attributes;
  const source = src.trim();
  const publicOrigin = getAllowedOrigin(ctx);

  if (/^https?:\/\//i.test(source)) {
    const url = new URL(source);
    const isRawGithub = url.protocol === 'https:' && url.hostname === 'raw.githubusercontent.com';
    const isAllowedOrigin = publicOrigin && url.origin === new URL(publicOrigin).origin;
    if (url.username || url.password || (!isRawGithub && !isAllowedOrigin)) {
      throw new Error(`OpenAPI URL host is not allowed: ${url.origin}`);
    }
    return url;
  }

  if (source.startsWith('//')) {
    throw new Error('Protocol-relative OpenAPI URLs are not supported');
  }

  const {
    owner,
    repo,
    branch,
    path: pagePath,
    pathprefix,
  } = content;
  if (!pagePath) {
    throw new Error('Page path is missing');
  }

  if (content.localMode && content.origin) {
    let localPath: string;
    if (pathprefix && source.startsWith(`${pathprefix}/`)) {
      localPath = `/static/${source.slice(pathprefix.length + 1)}`;
    } else {
      const currentDir = pagePath.slice(0, pagePath.lastIndexOf('/') + 1);
      const pageResource = source.startsWith('/')
        ? `/src/pages${source}`
        : new URL(source, `http://placeholder.invalid${currentDir}`).pathname;
      if (!pageResource.startsWith('/src/pages/')) {
        throw new Error('OpenAPI path resolves outside src/pages');
      }
      localPath = pageResource.slice('/src/pages'.length);
    }
    return new URL(localPath, content.origin);
  }

  if (!owner || !repo || !branch) {
    throw new Error('Repository context is incomplete');
  }

  if (publicOrigin && isPrivateContentOrg(owner)) {
    const prefix = pathprefix ?? '';
    if (source.startsWith(`${prefix}/`) && prefix) {
      const relativeStaticPath = source.slice(prefix.length).replace(/^\/+/, '');
      return new URL(`${prefix}/static/${relativeStaticPath}`, publicOrigin);
    }

    const currentDir = pagePath.slice(0, pagePath.lastIndexOf('/') + 1);
    const resolved = source.startsWith('/')
      ? source
      : new URL(source, `https://placeholder.invalid${currentDir}`).pathname;
    const pageResource = resolved.startsWith('/src/pages/')
      ? resolved.slice('/src/pages/'.length)
      : resolved.replace(/^\/+/, '');
    return new URL(`${prefix}/${pageResource}`, publicOrigin);
  }

  let resourcePath: string;
  if (pathprefix && source.startsWith(`${pathprefix}/`)) {
    resourcePath = `/static/${source.slice(pathprefix.length + 1)}`;
  } else if (source.startsWith('/')) {
    resourcePath = `/src/pages${source}`;
  } else {
    const currentDir = pagePath.slice(0, pagePath.lastIndexOf('/') + 1);
    resourcePath = new URL(source, `https://placeholder.invalid${currentDir}`).pathname;
    if (!resourcePath.startsWith('/src/pages/')) {
      throw new Error('OpenAPI path resolves outside src/pages');
    }
  }

  return new URL(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${resourcePath}`,
  );
}

function isAllowedUrl(ctx: Helix.UniversalContext, url: URL): boolean {
  const { content } = ctx.attributes;
  if (content.localMode && content.origin && url.origin === new URL(content.origin).origin) {
    return url.protocol === new URL(content.origin).protocol;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    return true;
  }
  const publicOrigin = getAllowedOrigin(ctx);
  if (publicOrigin && url.origin === new URL(publicOrigin).origin) {
    return true;
  }
  return false;
}

async function fetchText(
  ctx: Helix.UniversalContext,
  url: URL,
  fetcher: Fetcher,
  budget: FetchBudget,
): Promise<string> {
  if (!isAllowedUrl(ctx, url)) {
    throw new Error(`OpenAPI URL host is not allowed: ${url.origin}`);
  }

  const remainingTime = budget.deadline - Date.now();
  if (remainingTime <= 0) {
    throw new Error(`OpenAPI spec exceeded its ${TOTAL_TIMEOUT_MS}ms time budget`);
  }

  const response = await fetcher(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remainingTime)),
  });
  if (!response.ok) {
    throw new Error(`OpenAPI fetch returned ${response.status}: ${url.href}`);
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SPEC_BYTES) {
    throw new Error(`OpenAPI document exceeds ${MAX_SPEC_BYTES} bytes`);
  }

  const streamBody = response.body as ReadableStream<Uint8Array> | null;
  const reader = streamBody?.getReader();
  if (!reader) {
    const responseBody = await response.text();
    if (Buffer.byteLength(responseBody) > MAX_SPEC_BYTES) {
      throw new Error(`OpenAPI document exceeds ${MAX_SPEC_BYTES} bytes`);
    }
    if (Date.now() > budget.deadline) {
      throw new Error(`OpenAPI spec exceeded its ${TOTAL_TIMEOUT_MS}ms time budget`);
    }
    return responseBody;
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (!done) {
      byteLength += result.value.byteLength;
      if (byteLength > MAX_SPEC_BYTES) {
        await reader.cancel();
        throw new Error(`OpenAPI document exceeds ${MAX_SPEC_BYTES} bytes`);
      }
      chunks.push(result.value);
    }
  }
  if (Date.now() > budget.deadline) {
    throw new Error(`OpenAPI spec exceeded its ${TOTAL_TIMEOUT_MS}ms time budget`);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseSrc(block: Element): string {
  const code = select('code', block);
  const configText = code ? toString(code) : '';
  const srcLine = configText.split(/\r?\n/).find((line) => /^\s*data-src\s*=/.test(line));
  return srcLine ? srcLine.replace(/^\s*data-src\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2') : '';
}

export default async function prerenderRedocly(
  ctx: Helix.UniversalContext,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const { content } = ctx.attributes;
  const blocks = selectAll('.redoclyapiblock', content.hast);
  const budget: FetchBudget = {
    deadline: Date.now() + TOTAL_TIMEOUT_MS,
    documentCount: 0,
  };

  for (const block of blocks) {
    const src = parseSrc(block);
    if (!src) {
      ctx.log.warn('Skipping Redocly spec: data-src is missing');
      continue;
    }

    try {
      const sourceUrl = resolveSpecUrl(ctx, src);
      if (!isAllowedUrl(ctx, sourceUrl)) {
        throw new Error(`OpenAPI URL host is not allowed: ${sourceUrl.origin}`);
      }
      if (budget.documentCount >= MAX_OPENAPI_DOCUMENTS) {
        throw new Error(`OpenAPI specs exceeded the ${MAX_OPENAPI_DOCUMENTS}-document page limit`);
      }
      budget.documentCount += 1;
      const sourceText = await fetchText(ctx, sourceUrl, fetcher, budget);
      const parsed: unknown = parse(sourceText);
      if (!isObject(parsed)) {
        throw new Error(`OpenAPI document is not an object: ${sourceUrl.href}`);
      }

      const spec = h('pre', { className: 'redocly-spec' }, [
        h('code', sourceText),
      ]);
      block.children.unshift(h('noscript', spec));
      ctx.log.info(`Embedded full OpenAPI spec for ${sourceUrl.href}`);
    } catch (error) {
      ctx.log.error(`Unable to embed OpenAPI spec from "${src}"`, error);
    }
  }
}
