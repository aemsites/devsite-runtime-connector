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
import { toHtml } from 'hast-util-to-html';
import { parse } from 'yaml';
import type { Element } from 'hast';
import type { Helix } from '@adobe/helix-universal';
import type { ReadableStream } from 'node:stream/web';
import { isPrivateContentOrg, devSiteConnectorPublicOrigin } from './rewrite-links.js';

const METHODS = new Set([
  'get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace',
]);
const MAX_SPEC_BYTES = 2 * 1024 * 1024;
const MAX_SUMMARY_BYTES = 32 * 1024;
const MAX_OPERATIONS = 200;
const MAX_OPENAPI_DOCUMENTS = 20;
const MAX_CONCURRENT_REFERENCE_FETCHES = 4;
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

function text(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
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
    throw new Error(`OpenAPI summary exceeded its ${TOTAL_TIMEOUT_MS}ms time budget`);
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
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function decodePointer(pointer: string): string[] {
  if (!pointer || pointer === '#') {
    return [];
  }
  if (!pointer.startsWith('#/')) {
    throw new Error(`Unsupported OpenAPI reference fragment: ${pointer}`);
  }
  return pointer.slice(2).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getPointer(root: unknown, pointer: string): unknown {
  return decodePointer(pointer).reduce<unknown>((current, part) => {
    if (!isObject(current) && !Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, root);
}

function loadDocument(
  ctx: Helix.UniversalContext,
  url: URL,
  fetcher: Fetcher,
  documents: Map<string, OpenApiObject>,
  pendingDocuments: Map<string, Promise<OpenApiObject>>,
  budget: FetchBudget,
): Promise<OpenApiObject> {
  const cached = documents.get(url.href);
  if (cached) {
    return Promise.resolve(cached);
  }
  const pending = pendingDocuments.get(url.href);
  if (pending !== undefined) {
    return pending;
  }
  if (budget.documentCount >= MAX_OPENAPI_DOCUMENTS) {
    throw new Error(`OpenAPI summary exceeded its ${MAX_OPENAPI_DOCUMENTS}-document limit`);
  }
  budget.documentCount += 1;

  const loading = (async () => {
    const sourceText = await fetchText(ctx, url, fetcher, budget);
    const parsed: unknown = parse(sourceText);
    if (!isObject(parsed)) {
      throw new Error(`OpenAPI document is not an object: ${url.href}`);
    }
    documents.set(url.href, parsed);
    return parsed;
  })();
  pendingDocuments.set(url.href, loading);
  return loading;
}

async function resolveReference(
  ctx: Helix.UniversalContext,
  value: unknown,
  documentUrl: URL,
  fetcher: Fetcher,
  documents: Map<string, OpenApiObject>,
  pendingDocuments: Map<string, Promise<OpenApiObject>>,
  budget: FetchBudget,
  seen = new Set<string>(),
): Promise<unknown> {
  if (!isObject(value) || typeof value.$ref !== 'string') {
    return value;
  }

  const ref = value.$ref;
  const separator = ref.indexOf('#');
  const refPath = separator < 0 ? ref : ref.slice(0, separator);
  const fragment = separator < 0 ? '' : ref.slice(separator);
  const refUrl = refPath ? new URL(refPath, documentUrl) : documentUrl;
  const key = `${refUrl.href}${fragment}`;
  if (seen.has(key)) {
    throw new Error(`Circular OpenAPI reference: ${key}`);
  }
  const nextSeen = new Set(seen).add(key);

  const document = await loadDocument(
    ctx,
    refUrl,
    fetcher,
    documents,
    pendingDocuments,
    budget,
  );

  const target = getPointer(document, fragment);
  if (target === undefined) {
    throw new Error(`OpenAPI reference target was not found: ${key}`);
  }
  return resolveReference(
    ctx,
    target,
    refUrl,
    fetcher,
    documents,
    pendingDocuments,
    budget,
    nextSeen,
  );
}

async function resolveParameters(
  ctx: Helix.UniversalContext,
  parameters: unknown,
  documentUrl: URL,
  fetcher: Fetcher,
  documents: Map<string, OpenApiObject>,
  pendingDocuments: Map<string, Promise<OpenApiObject>>,
  budget: FetchBudget,
): Promise<OpenApiObject[]> {
  if (!Array.isArray(parameters)) {
    return [];
  }
  const resolved: OpenApiObject[] = [];
  for (let index = 0; index < parameters.length; index += MAX_CONCURRENT_REFERENCE_FETCHES) {
    const batch = parameters.slice(index, index + MAX_CONCURRENT_REFERENCE_FETCHES);
    const batchResults = await Promise.all(batch.map((parameter) => resolveReference(
      ctx,
      parameter,
      documentUrl,
      fetcher,
      documents,
      pendingDocuments,
      budget,
    )));
    resolved.push(...batchResults.filter(isObject));
  }
  return resolved;
}

function operationSection(
  method: string,
  path: string,
  operation: OpenApiObject,
  parameters: OpenApiObject[],
): ReturnType<typeof h> {
  const summary = text(operation.summary, 300) || `${method.toUpperCase()} ${path}`;
  const description = text(operation.description, 1000);
  const section = h('section', [
    h('h2', summary),
    h('p', [h('code', `${method.toUpperCase()} ${path}`)]),
  ]);
  if (description) {
    section.children.push(h('p', description));
  }

  const listedParameters = parameters
    .map((parameter) => ({
      name: text(parameter.name, 200),
      location: text(parameter.in, 100),
      description: text(parameter.description, 500),
    }))
    .filter((parameter) => parameter.name);
  if (listedParameters.length) {
    section.children.push(h('h3', 'Parameters'));
    section.children.push(h('ul', listedParameters.map(({ name, location, description: detail }) => {
      const label = `${name}${location ? ` (${location})` : ''}`;
      return h('li', detail ? `${label} — ${detail}` : label);
    })));
  }
  return section;
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
      ctx.log.warn('Skipping Redocly summary: data-src is missing');
      continue;
    }

    try {
      const sourceUrl = resolveSpecUrl(ctx, src);
      if (!isAllowedUrl(ctx, sourceUrl)) {
        throw new Error(`OpenAPI URL host is not allowed: ${sourceUrl.origin}`);
      }
      const documents = new Map<string, OpenApiObject>();
      const pendingDocuments = new Map<string, Promise<OpenApiObject>>();
      const spec = await loadDocument(
        ctx,
        sourceUrl,
        fetcher,
        documents,
        pendingDocuments,
        budget,
      );
      if (!isObject(spec.paths)) {
        throw new Error('OpenAPI document does not contain a paths object');
      }

      const info = isObject(spec.info) ? spec.info : {};
      const seo = h('div', { className: 'redocly-seo' }, [
        h('h1', text(info.title, 300) || 'API Reference'),
      ]);
      const apiDescription = text(info.description, 1000);
      if (apiDescription) {
        seo.children.push(h('p', apiDescription));
      }

      let operationCount = 0;
      let reachedSizeCap = false;
      for (const [path, rawPathItem] of Object.entries(spec.paths)) {
        const pathItemValue = await resolveReference(
          ctx,
          rawPathItem,
          sourceUrl,
          fetcher,
          documents,
          pendingDocuments,
          budget,
        );
        if (!isObject(pathItemValue)) {
          continue;
        }
        const pathParameters = await resolveParameters(
          ctx,
          pathItemValue.parameters,
          sourceUrl,
          fetcher,
          documents,
          pendingDocuments,
          budget,
        );

        for (const [method, rawOperation] of Object.entries(pathItemValue)) {
          if (!METHODS.has(method.toLowerCase()) || !isObject(rawOperation)) {
            continue;
          }
          const operationParameters = await resolveParameters(
            ctx,
            rawOperation.parameters,
            sourceUrl,
            fetcher,
            documents,
            pendingDocuments,
            budget,
          );
          const parameters = [...pathParameters, ...operationParameters]
            .filter((parameter, index, list) => list.findIndex((other) => (
              other.name === parameter.name && other.in === parameter.in
            )) === index);
          const section = operationSection(method, path, rawOperation, parameters);
          if (Buffer.byteLength(toHtml(section)) + Buffer.byteLength(toHtml(seo))
            > MAX_SUMMARY_BYTES) {
            ctx.log.warn(`Redocly summary reached the ${MAX_SUMMARY_BYTES}-byte size cap`);
            reachedSizeCap = true;
            break;
          }
          seo.children.push(section);
          operationCount += 1;
          if (operationCount >= MAX_OPERATIONS) {
            ctx.log.warn(`Redocly summary reached the ${MAX_OPERATIONS}-operation cap`);
            break;
          }
        }
        if (operationCount >= MAX_OPERATIONS || reachedSizeCap) {
          break;
        }
      }

      if (!operationCount) {
        ctx.log.warn(`Skipping Redocly summary: no operations found in ${sourceUrl.href}`);
        continue;
      }

      block.children.unshift(h('noscript', seo));
      ctx.log.info(
        `Generated Redocly summary for ${sourceUrl.href} (${operationCount} operations)`,
      );
    } catch (error) {
      ctx.log.error(`Unable to generate Redocly summary for "${src}"`, error);
    }
  }
}
