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

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { Helix } from '@adobe/helix-universal';
import { DEFAULT_CONTEXT, minifyHtml } from './util.js';
import md2markup from '../src/md2markup.js';

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('md2markup', () => {
  let ctx: Helix.UniversalContext;
  beforeEach(() => {
    ctx = DEFAULT_CONTEXT({
      log: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      attributes: { content: {} },
    });
  });

  async function runTest(name: string, root: string = '/src/pages/rest', suffix: string = '/test.md') {
    ctx.pathInfo.suffix = suffix;
    ctx.attributes.content.root = root;
    ctx.attributes.content.path = root + suffix;
    ctx.attributes.content.md = await fs.readFile(path.resolve(__dirname, 'fixtures', `${name}.md`), 'utf-8');
    const expected = await fs.readFile(path.resolve(__dirname, 'fixtures', `${name}.html`), 'utf-8');
    const html = await md2markup(ctx);
    // console.log(html);
    expect(minifyHtml(html)).to.equal(minifyHtml(expected));
  }

  it('should convert markdown to markup (simple)', async () => {
    await runTest('simple');
  });

  it('should convert markdown to markup (gridtable)', async () => {
    await runTest('gridtable');
  });

  it('should convert markdown to markup (simple-block)', async () => {
    await runTest('simple-block');
  });

  it('should convert markdown to markup (repeat-block)', async () => {
    await runTest('repeat-block');
  });

  it('should convert markdown to markup (table)', async () => {
    await runTest('table');
  });

  it('should convert markdown to markup (partial)', async () => {
    await runTest('partial', undefined, '/b2b/company-users.md');
  });

  it('should convert markdown to markup (page)', async () => {
    await runTest('page', undefined, '/b2b/company-users.md');
  });

  it('adds a crawlable summary and resolves referenced parameters', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/openapi.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const responses = new Map([
      ['https://raw.githubusercontent.com/AdobeDocs/dev-docs-reference/main/src/pages/assets/openapi.yaml', `
openapi: 3.0.0
info:
  title: Example API
  description: 'Example <script>alert(1)</script> API'
paths:
  /pets:
    get:
      summary: List pets
      description: Returns available pets
      parameters:
        - $ref: ./parameters.yaml#/components/parameters/limit
      responses:
        '200':
          description: ok
`],
      ['https://raw.githubusercontent.com/AdobeDocs/dev-docs-reference/main/src/pages/assets/parameters.yaml', `
components:
  parameters:
    limit:
      name: limit
      in: query
      description: Maximum pets to return
`],
    ]);
    const fetchedUrls: string[] = [];
    const fetcher = (input: string | URL | Request) => {
      fetchedUrls.push(String(input));
      const body = responses.get(String(input));
      return Promise.resolve(new Response(body, {
        status: body ? 200 : 404,
        headers: { 'content-type': 'application/yaml' },
      }));
    };

    const html = await md2markup(ctx, fetcher);
    expect(html).to.contain('<noscript>');
    expect(html).to.contain('<h1>Example API</h1>');
    expect(html).to.contain('&#x3C;script>alert(1)&#x3C;/script>');
    expect(html).not.to.contain('<script>alert(1)</script>');
    expect(html).to.contain('<h2>List pets</h2>');
    expect(html).to.contain('GET /pets');
    expect(html).to.contain('Maximum pets to return');
    expect(html).to.contain('data-src=../../assets/openapi.yaml');
    expect(fetchedUrls).to.have.length(2);
  });

  it('leaves the Redocly block unchanged when spec fetching fails', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/missing.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const html = await md2markup(
      ctx,
      () => Promise.resolve(new Response('', { status: 404 })),
    );
    expect(html).not.to.contain('<noscript>');
    expect(html).to.contain('data-src=../../assets/missing.yaml');
  });

  it('resolves OpenAPI assets through the local content server', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../assets/local.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/api/reference.md';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';
    ctx.attributes.content.localMode = true;
    ctx.attributes.content.origin = 'http://127.0.0.1:3003';

    let fetchedUrl = '';
    const html = await md2markup(ctx, (input: string | URL | Request) => {
      fetchedUrl = String(input);
      return Promise.resolve(new Response(`
openapi: 3.0.0
info:
  title: Local API
paths:
  /health:
    get:
      summary: Get health
      responses:
        '200':
          description: ok
`));
    });

    expect(fetchedUrl).to.equal('http://127.0.0.1:3003/assets/local.yaml');
    expect(html).to.contain('<h1>Local API</h1>');
    expect(html).to.contain('GET /health');
  });

  it('limits the number of OpenAPI documents fetched for a page', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/openapi.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const references = Array.from({ length: 20 }, (_, index) => (
      `        - $ref: ./parameter-${index}.yaml#/components/parameters/value`
    )).join('\n');
    const spec = `openapi: 3.0.0
info:
  title: Example API
paths:
  /pets:
    get:
      summary: List pets
      parameters:
${references}
      responses:
        '200':
          description: ok
`;
    const fetchedUrls: string[] = [];
    const html = await md2markup(ctx, (input: string | URL | Request) => {
      const url = String(input);
      fetchedUrls.push(url);
      const body = url.endsWith('/openapi.yaml')
        ? spec
        : 'components:\n  parameters:\n    value:\n      name: value\n      in: query\n';
      return Promise.resolve(new Response(body));
    });

    expect(fetchedUrls).to.have.length(20);
    expect(html).not.to.contain('<noscript>');
  });

  it('stops fetching when the page-wide time budget expires', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/openapi.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const originalNow = Date.now;
    let now = 0;
    Date.now = () => now;
    const fetchedUrls: string[] = [];
    try {
      const html = await md2markup(ctx, (input: string | URL | Request) => {
        const url = String(input);
        fetchedUrls.push(url);
        now = 20_000;
        return Promise.resolve(new Response(`openapi: 3.0.0
info:
  title: Example API
paths:
  /pets:
    get:
      parameters:
        - $ref: ./parameter.yaml#/components/parameters/value
      responses:
        '200':
          description: ok
`));
      });

      expect(fetchedUrls).to.have.length(1);
      expect(html).not.to.contain('<noscript>');
    } finally {
      Date.now = originalNow;
    }
  });
});
