/**
 * Test cases based on:
 * https://developer-stage.adobe.com/github-actions-test/test/test-url
 */

import { Helix } from '@adobe/helix-universal';
import {
  resolve,
  isPrivateContentOrg,
  devSiteConnectorUsePublicAssetUrls,
  devSiteConnectorPublicOrigin,
} from '../src/steps/rewrite-links.js';
import rewriteLinks from '../src/steps/rewrite-links.js';
import { DEFAULT_CONTEXT } from './util.js';

const CONNECTOR_FLAG = 'DEVSITE_CONNECTOR_FLAG';
const CONNECTOR_PUBLIC_ORIGIN = 'DEVSITE_CONNECTOR_PUBLIC_ORIGIN';

function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
}

describe('rewrite-links', () => {
  describe('isPrivateContentOrg', () => {
    it('returns true for AdobeDocsPrivate org', () => {
      expect(isPrivateContentOrg('AdobeDocsPrivate')).to.equal(true);
    });

    it('returns false for public AdobeDocs org', () => {
      expect(isPrivateContentOrg('AdobeDocs')).to.equal(false);
    });

    it('returns false when owner is missing', () => {
      expect(isPrivateContentOrg(undefined)).to.equal(false);
    });
  });

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

      it('should use public origin + pathprefix for private org images when connector flag is set (remote mode)', () => {
        const prevFlag = process.env[CONNECTOR_FLAG];
        const prevOrigin = process.env[CONNECTOR_PUBLIC_ORIGIN];
        try {
          process.env[CONNECTOR_FLAG] = 'true';
          process.env[CONNECTOR_PUBLIC_ORIGIN] = 'https://developer-stage.adobe.com';

          const privateCtx = DEFAULT_CONTEXT({
            attributes: {
              content: {
                root: '/src/pages/support',
                path: '/src/pages/support/index.md',
                pathprefix: '/private-eds',
                owner: 'AdobeDocsPrivate',
                repo: 'adp-dev-docs-private',
                branch: 'main',
                localMode: true,
                origin: 'https://raw.githubusercontent.com',
              },
            },
          });

          const result = resolve(privateCtx, 'cc.png', 'img');
          expect(result).to.equal(
            'https://developer-stage.adobe.com/private-eds/support/cc.png',
          );
          expect(result).to.not.include('raw.githubusercontent.com');
        } finally {
          restoreEnv(CONNECTOR_FLAG, prevFlag);
          restoreEnv(CONNECTOR_PUBLIC_ORIGIN, prevOrigin);
        }
      });

      it('should NOT use public origin + pathprefix for private org images when connector flag is not set (local mode)', () => {
        const prevFlag = process.env[CONNECTOR_FLAG];
        const prevOrigin = process.env[CONNECTOR_PUBLIC_ORIGIN];
        try {
          process.env[CONNECTOR_FLAG] = 'undefined';
          process.env[CONNECTOR_PUBLIC_ORIGIN] = 'undefined';

          const privateCtx = DEFAULT_CONTEXT({
            attributes: {
              content: {
                root: '/src/pages/support',
                path: '/src/pages/support/index.md',
                pathprefix: '/private-eds',
                owner: 'AdobeDocsPrivate',
                repo: 'adp-dev-docs-private',
                branch: 'main',
                localMode: true,
                origin: 'http://127.0.0.1:3003',
              },
            },
          });

          const result = resolve(privateCtx, 'cc.png', 'img');
          expect(result).to.equal(
            'http://127.0.0.1:3003/support/cc.png',
          );
          expect(result).to.not.include('raw.githubusercontent.com');
        } finally {
          restoreEnv(CONNECTOR_FLAG, prevFlag);
          restoreEnv(CONNECTOR_PUBLIC_ORIGIN, prevOrigin);
        }
      });

      it('should fall back to raw GitHub when connector flag is off (private org)', () => {
        const privateCtx = DEFAULT_CONTEXT({
          attributes: {
            content: {
              root: '/src/pages/support',
              path: '/src/pages/support/index.md',
              pathprefix: '/private-eds',
              owner: 'AdobeDocsPrivate',
              repo: 'adp-dev-docs-private',
              branch: 'main',
              localMode: false,
              origin: 'https://raw.githubusercontent.com',
            },
          },
        });

        const result = resolve(privateCtx, 'cc.png', 'img');
        expect(result).to.include('raw.githubusercontent.com');
      });

      it('should use DEVSITE_CONNECTOR_PUBLIC_ORIGIN when DEVSITE_CONNECTOR_FLAG is true (private org)', () => {
        const prevFlag = process.env[CONNECTOR_FLAG];
        const prevOrigin = process.env[CONNECTOR_PUBLIC_ORIGIN];
        try {
          process.env[CONNECTOR_FLAG] = 'true';
          process.env[CONNECTOR_PUBLIC_ORIGIN] = 'https://developer.adobe.com/';
          expect(devSiteConnectorUsePublicAssetUrls()).to.equal(true);
          expect(devSiteConnectorPublicOrigin()).to.equal('https://developer.adobe.com');

          const privateCtx = DEFAULT_CONTEXT({
            attributes: {
              content: {
                root: '/src/pages/support',
                path: '/src/pages/support/index.md',
                pathprefix: '/private-eds',
                owner: 'AdobeDocsPrivate',
                repo: 'adp-dev-docs-private',
                branch: 'main',
                localMode: true,
                origin: 'https://raw.githubusercontent.com',
              },
            },
          });

          const result = resolve(privateCtx, 'cc.png', 'img');
          expect(result).to.equal('https://developer.adobe.com/private-eds/support/cc.png');
        } finally {
          restoreEnv(CONNECTOR_FLAG, prevFlag);
          restoreEnv(CONNECTOR_PUBLIC_ORIGIN, prevOrigin);
        }
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

    describe('Anchor hrefs to downloadable / static assets', () => {
      it('should generate GitHub raw URL for .zip (remote, public org)', () => {
        const result = resolve(ctx, './assets/sample.zip', 'a');
        expect(result).to.include('raw.githubusercontent.com');
        expect(result).to.include('AdobeDocs');
        expect(result).to.include('github-actions-test');
        expect(result).to.include('sample.zip');
      });

      it('should generate GitHub raw URL for .pdf (remote, public org)', () => {
        const result = resolve(ctx, './assets/guide.pdf', 'a');
        expect(result).to.include('raw.githubusercontent.com');
        expect(result).to.include('guide.pdf');
      });

      it('should generate GitHub raw URL for .d.ts (remote, public org)', () => {
        const result = resolve(ctx, './types/example.d.ts', 'a');
        expect(result).to.include('raw.githubusercontent.com');
        expect(result).to.include('example.d.ts');
      });

      it('should use public origin + pathprefix for private org .zip anchor when connector flag is set', () => {
        const prevFlag = process.env[CONNECTOR_FLAG];
        const prevOrigin = process.env[CONNECTOR_PUBLIC_ORIGIN];
        try {
          process.env[CONNECTOR_FLAG] = 'true';
          process.env[CONNECTOR_PUBLIC_ORIGIN] = 'https://developer-stage.adobe.com';

          const privateCtx = DEFAULT_CONTEXT({
            attributes: {
              content: {
                root: '/src/pages/support',
                path: '/src/pages/support/index.md',
                pathprefix: '/private-eds',
                owner: 'AdobeDocsPrivate',
                repo: 'adp-dev-docs-private',
                branch: 'main',
                localMode: true,
                origin: 'https://raw.githubusercontent.com',
              },
            },
          });

          const result = resolve(privateCtx, './assets/bundle.zip', 'a');
          expect(result).to.equal(
            'https://developer-stage.adobe.com/private-eds/support/assets/bundle.zip',
          );
          expect(result).to.not.include('raw.githubusercontent.com');
        } finally {
          restoreEnv(CONNECTOR_FLAG, prevFlag);
          restoreEnv(CONNECTOR_PUBLIC_ORIGIN, prevOrigin);
        }
      });

      it('should use local content origin for .zip in local mode', () => {
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

        const result = resolve(localCtx, './files/demo.zip', 'a');
        expect(result).to.include('127.0.0.1:3003');
        expect(result).to.include('demo.zip');
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
