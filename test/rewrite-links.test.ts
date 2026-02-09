/**
 * Test cases based on:
 * https://developer-stage.adobe.com/github-actions-test/test/test-url
 */

import { Helix } from '@adobe/helix-universal';
import { resolve } from '../src/steps/rewrite-links.js';
import rewriteLinks from '../src/steps/rewrite-links.js';
import { DEFAULT_CONTEXT } from './util.js';

describe('rewrite-links', () => {
  let ctx: Helix.UniversalContext;

  beforeEach(() => {
    // Context simulates being at /github-actions-test/test/test-url.md
    ctx = DEFAULT_CONTEXT({
      attributes: {
        content: {
          root: '/src/pages/test',
          path: '/src/pages/test/test-url.md',
          pathprefix: '/github-actions-test/test',
          owner: 'AdobeDocs',
          repo: 'github-actions-test',
          branch: 'main',
          localMode: false,
          origin: 'https://raw.githubusercontent.com',
        },
      },
    });
  });

  describe('resolve() function', () => {
    describe('External links - should not be rewritten', () => {
      it('should not rewrite http:// links', () => {
        const result = resolve(ctx, 'http://example.com', 'a');
        expect(result).to.equal('http://example.com');
      });

      it('should not rewrite https:// links', () => {
        const result = resolve(ctx, 'https://example.com/path', 'a');
        expect(result).to.equal('https://example.com/path');
      });

      it('should not rewrite mailto: links', () => {
        const result = resolve(ctx, 'mailto:test@example.com', 'a');
        expect(result).to.equal('mailto:test@example.com');
      });
    });

    it('Testing path relative link relative to current directory', () => {
      const result = resolve(ctx, 'path-test/index.md', 'a');
      expect(result).to.equal('/github-actions-test/test/test/path-test/index.md');
    });

    it('Root relative link', () => {
      const result = resolve(ctx, '/api/index.md', 'a');
      expect(result).to.equal('/github-actions-test/test/api/index.md');
    });

    it('path relative link that goes to parent of current directory', () => {
      const result = resolve(ctx, '../support/index.md', 'a');
      expect(result).to.equal('/github-actions-test/test/support/index.md');
    });

    it('path explicit relative link to current directory', () => {
      const result = resolve(ctx, './path-test/index.md', 'a');
      expect(result).to.equal('/github-actions-test/test/test/path-test/index.md');
    });

    it('path relative link to a file without a trailing slash', () => {
      const result = resolve(ctx, 'path-test/pathname', 'a');
      expect(result).to.equal('/path-test/pathname');
    });

    it('path relative link to a file with a trailing slash', () => {
      const result = resolve(ctx, 'path-test/pathname/', 'a');
      expect(result).to.equal('/path-test/pathname');
    });

    it('path relative link to a file with a trailing slash but no index.md should fail', () => {
      const result = resolve(ctx, 'path-test/pathname/', 'a');
      // Without index.md, this should not convert to index.md
      expect(result).to.equal('/path-test/pathname');
    });

    it('path relative link to a file without a trailing slash and no .md should fail', () => {
      const result = resolve(ctx, 'path-test/pathname', 'a');
      // Without .md extension, this should not be treated as markdown
      expect(result).to.equal('/path-test/pathname');
    });

    it('path relative link to a file with a trailing slash goes to index.md', () => {
      const result = resolve(ctx, 'path-test/', 'a');
      expect(result).to.equal('/path-test');
    });

    it('path relative link to a file without a trailing slash goes to index.md', () => {
      const result = resolve(ctx, 'path-test', 'a');
      expect(result).to.equal('/path-test');
    });

    it('testing anchor link on the current page', () => {
      const result = resolve(ctx, '#path-relative-link-that-goes-to-parent-of-current-directory', 'a');
      expect(result).to.equal('#path-relative-link-that-goes-to-parent-of-current-directory');
    });

    it('testing anchor link on another page', () => {
      const result = resolve(ctx, 'anchor-link-in-table#request-object', 'a');
      expect(result).to.equal('/anchor-link-in-table#request-object');
    });

    it('testing anchor link on another page with md in the link', () => {
      const result = resolve(ctx, 'anchor-link-in-table.md#request-object', 'a');
      expect(result).to.equal('/github-actions-test/test/test/anchor-link-in-table.md#request-object');
    });

    it('external link with no http and https should fail', () => {
      const result = resolve(ctx, 'www.google.com', 'a');
      // www.google.com is not recognized as external, so it gets rewritten as a relative path
      expect(result).to.equal('/www.google.com');
    });

    describe('Links that already have pathprefix', () => {
      it('should not rewrite links that already have pathprefix', () => {
        const result = resolve(ctx, '/github-actions-test/test/some-page', 'a');
        expect(result).to.equal('/github-actions-test/test/some-page');
      });
    });

    describe('Image handling', () => {
      it('should generate GitHub raw URL for images (remote mode)', () => {
        const result = resolve(ctx, './images/screenshot.png', 'img');
        expect(result).to.include('raw.githubusercontent.com');
        expect(result).to.include('AdobeDocs');
        expect(result).to.include('github-actions-test');
      });

      it('should generate local URL for images (local mode)', () => {
        const localCtx = DEFAULT_CONTEXT({
          attributes: {
            content: {
              root: '/src/pages/test',
              path: '/src/pages/test/test-page.md',
              pathprefix: '/github-actions-test/test',
              owner: 'AdobeDocs',
              repo: 'github-actions-test',
              branch: 'main',
              localMode: true,
              origin: 'http://127.0.0.1:3003',
            },
          },
        });

        const result = resolve(localCtx, './images/screenshot.png', 'img');
        expect(result).to.include('127.0.0.1:3003');
      });
    });
  });

  describe('rewriteLinks() function - HAST transformation', () => {
    it('should rewrite href in anchor elements and remove .md extension', () => {
      ctx.attributes.content.hast = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: './other-page.md' },
            children: [{ type: 'text', value: 'Link' }],
          },
        ],
      };

      rewriteLinks(ctx);

      const anchor = ctx.attributes.content.hast.children[0];
      expect(anchor.properties.href).to.not.include('.md');
      expect(anchor.properties.href).to.include('/github-actions-test/test');
    });

    it('should rewrite src in img elements to GitHub raw URL', () => {
      ctx.attributes.content.hast = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'img',
            properties: { src: './images/photo.png' },
            children: [],
          },
        ],
      };

      rewriteLinks(ctx);

      const img = ctx.attributes.content.hast.children[0];
      expect(img.properties.src).to.include('raw.githubusercontent.com');
    });

    it('should handle index.md links by removing index.md', () => {
      ctx.attributes.content.hast = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: './folder/index.md' },
            children: [{ type: 'text', value: 'Folder' }],
          },
        ],
      };

      rewriteLinks(ctx);

      const anchor = ctx.attributes.content.hast.children[0];
      expect(anchor.properties.href).to.not.include('index.md');
    });

    it('should handle .md# links by removing .md but keeping anchor', () => {
      ctx.attributes.content.hast = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: './page.md#section' },
            children: [{ type: 'text', value: 'Section Link' }],
          },
        ],
      };

      rewriteLinks(ctx);

      const anchor = ctx.attributes.content.hast.children[0];
      expect(anchor.properties.href).to.include('#section');
      expect(anchor.properties.href).to.not.include('.md');
    });

    it('should not modify external links', () => {
      ctx.attributes.content.hast = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: 'https://adobe.com' },
            children: [{ type: 'text', value: 'Adobe' }],
          },
        ],
      };

      rewriteLinks(ctx);

      const anchor = ctx.attributes.content.hast.children[0];
      expect(anchor.properties.href).to.equal('https://adobe.com');
    });

    it('should handle multiple links in document', () => {
      ctx.attributes.content.hast = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'a',
                properties: { href: './page1.md' },
                children: [{ type: 'text', value: 'Page 1' }],
              },
              {
                type: 'element',
                tagName: 'a',
                properties: { href: 'https://external.com' },
                children: [{ type: 'text', value: 'External' }],
              },
              {
                type: 'element',
                tagName: 'img',
                properties: { src: './image.png' },
                children: [],
              },
            ],
          },
        ],
      };

      rewriteLinks(ctx);

      const div = ctx.attributes.content.hast.children[0];
      const [link1, link2, img] = div.children;

      expect(link1.properties.href).to.include('/github-actions-test/test');
      expect(link1.properties.href).to.not.include('.md');
      expect(link2.properties.href).to.equal('https://external.com');
      expect(img.properties.src).to.include('raw.githubusercontent.com');
    });
  });
});
