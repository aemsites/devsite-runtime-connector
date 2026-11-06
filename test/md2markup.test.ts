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

  it('embeds the full YAML spec without resolving or dropping its content', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/openapi.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const source = `
openapi: 3.0.0
info:
  title: Example API
  description: 'Example <script>alert(1)</script> API'
paths:
  /pets/{petId}:
    put:
      summary: Update a pet
      description: Updates a pet and returns the complete representation.
      parameters:
        - $ref: ./parameters.yaml#/components/parameters/limit
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Pet'
      responses:
        '200':
          description: Updated pet
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
components:
  schemas:
    Pet:
      type: object
      required:
        - name
      properties:
        name:
          type: string
          example: Fluffy
`;
    const specUrl = 'https://raw.githubusercontent.com/AdobeDocs/dev-docs-reference/main/src/pages/assets/openapi.yaml';
    const responses = new Map([[specUrl, source]]);
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
    expect(html).to.contain('<pre class="redocly-spec">');
    expect(html).to.contain('&#x3C;script>alert(1)&#x3C;/script>');
    expect(html).not.to.contain('<script>alert(1)</script>');
    expect(html).to.contain('requestBody:');
    expect(html).to.contain('example: Fluffy');
    expect(html).to.contain('$ref: ./parameters.yaml#/components/parameters/limit');
    expect(html).not.to.contain('<h2>Update a pet</h2>');
    expect(html).to.contain('data-src=../../assets/openapi.yaml');
    expect(fetchedUrls).to.deep.equal([specUrl]);
  });

  it('embeds JSON specs, including schemas and examples', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/openapi.json" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';
    const source = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'JSON API' },
      paths: {},
      components: {
        schemas: {
          Result: {
            type: 'object',
            properties: { message: { type: 'string', example: '<hello>' } },
          },
        },
      },
    }, null, 2);

    const html = await md2markup(
      ctx,
      () => Promise.resolve(new Response(source)),
    );

    expect(html).to.contain('<pre class="redocly-spec">');
    expect(html).to.contain('"Result"');
    expect(html).to.contain('"example": "&#x3C;hello>"');
    expect(html).not.to.contain('<hello>');
  });

  it('resolves and embeds path-prefixed static specs such as the Firefly API spec', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="/firefly-services/docs/firefly-api/firefly-api.json" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/api.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'ffs-firefly-api';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/firefly-services/docs/firefly-api';

    let fetchedUrl = '';
    const source = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Firefly API' },
      paths: {},
      components: { schemas: { FullSpec: { type: 'object' } } },
    });
    const html = await md2markup(ctx, (input: string | URL | Request) => {
      fetchedUrl = String(input);
      return Promise.resolve(new Response(source));
    });

    expect(fetchedUrl).to.equal(
      'https://raw.githubusercontent.com/AdobeDocs/ffs-firefly-api/main/static/firefly-api.json',
    );
    expect(html).to.contain('"FullSpec"');
    expect(html).to.contain('data-src=/firefly-services/docs/firefly-api/firefly-api.json');
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

  it('leaves the Redocly block unchanged when the fetched document is not a spec object', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/not-a-spec.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const html = await md2markup(
      ctx,
      () => Promise.resolve(new Response('This is not an OpenAPI document')),
    );

    expect(html).not.to.contain('<noscript>');
    expect(html).to.contain('data-src=../../assets/not-a-spec.yaml');
  });

  it('does not embed a document larger than the per-spec limit', async () => {
    ctx.attributes.content.md = '<RedoclyAPIBlock src="../../assets/large.yaml" />';
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const oversizedSpec = 'x'.repeat(2 * 1024 * 1024 + 1);
    const html = await md2markup(
      ctx,
      () => Promise.resolve(new Response(oversizedSpec)),
    );

    expect(html).not.to.contain('<noscript>');
    expect(html).to.contain('data-src=../../assets/large.yaml');
  });

  it('embeds OpenAPI assets fetched through the local content server', async () => {
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
    expect(html).to.contain('title: Local API');
    expect(html).to.contain('summary: Get health');
  });

  it('limits the number of OpenAPI documents fetched for a page', async () => {
    ctx.attributes.content.md = Array.from({ length: 21 }, (_, index) => (
      `<RedoclyAPIBlock src="../../assets/openapi-${index}.yaml" />`
    )).join('\n\n');
    ctx.attributes.content.root = '/src/pages';
    ctx.attributes.content.path = '/src/pages/blocks/redoclyapiblock/example.md';
    ctx.attributes.content.owner = 'AdobeDocs';
    ctx.attributes.content.repo = 'dev-docs-reference';
    ctx.attributes.content.branch = 'main';
    ctx.attributes.content.pathprefix = '/dev-docs-reference';

    const fetchedUrls: string[] = [];
    const html = await md2markup(ctx, (input: string | URL | Request) => {
      const url = String(input);
      fetchedUrls.push(url);
      return Promise.resolve(new Response('openapi: 3.0.0\npaths: {}\n'));
    });

    expect(fetchedUrls).to.have.length(20);
    expect(html.match(/<noscript>/g)).to.have.length(20);
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
        return Promise.resolve(new Response('openapi: 3.0.0\npaths: {}\n'));
      });

      expect(fetchedUrls).to.have.length(1);
      expect(html).not.to.contain('<noscript>');
    } finally {
      Date.now = originalNow;
    }
  });
});
