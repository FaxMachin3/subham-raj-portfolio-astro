import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './fixtures';

// A rebuilt document can clamp native restoration to its partially parsed height.
// Recover the departure position when parsing completes, without hiding content.
for (const action of ['browser Back', 'return link']) {
  test(`${action} restores a streamed history document without hiding the page`, async ({
    page,
    baseURL,
  }) => {
    let homepageRequests = 0;
    const server = http.createServer(async (request, response) => {
      try {
        const upstream = await fetch(`${baseURL}${request.url}`);
        const body = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        if (new URL(request.url!, baseURL).pathname === '/' && ++homepageRequests > 1) {
          const html = body.toString();
          const first = html.indexOf('</section>') + '</section>'.length;
          const second = html.lastIndexOf('<section', html.indexOf('id="work"'));
          response.write(html.slice(0, first));
          await new Promise((resolve) => setTimeout(resolve, 200));
          response.write(html.slice(first, second));
          await new Promise((resolve) => setTimeout(resolve, 450));
          response.end(html.slice(second));
        } else {
          response.end(body);
        }
      } catch {
        if (!response.headersSent) response.writeHead(500);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    try {
      await page.addInitScript(() => {
        // Exercise the rebuilt-document path rather than a BFCache hit.
        addEventListener('unload', () => {});
        const state = window as unknown as { __paintPositions: number[]; __canvasFrames: string[] };
        state.__paintPositions = [];
        state.__canvasFrames = [];
        let count = 0;
        const frame = () => {
          if (document.body) {
            const root = getComputedStyle(document.documentElement);
            state.__canvasFrames.push(`${root.visibility}:${root.backgroundColor}`);
          }
          if (
            location.pathname === '/' &&
            document.body &&
            getComputedStyle(document.body).visibility === 'visible'
          ) {
            state.__paintPositions.push(scrollY);
          }
          if (++count < 150) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const study = page.getByRole('link', { name: /Making an investigation graph interactive/ });
      await study.scrollIntoViewIfNeeded();
      const position = await page.evaluate(() => scrollY);
      await study.click();
      if (action === 'browser Back') await page.goBack();
      else await page.getByRole('link', { name: '← All case studies', exact: true }).click();
      await expect(page).toHaveURL(url);
      await page.waitForLoadState('load');
      await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.body).visibility))
        .toBe('visible');
      await page.waitForTimeout(100);
      const frames = await page.evaluate(
        () => (window as unknown as { __paintPositions: number[] }).__paintPositions,
      );
      expect(homepageRequests, 'the homepage was rebuilt from streamed HTML').toBe(2);
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.at(-1), 'fully parsed page returns to the saved position').toBeCloseTo(position, 0);
      expect(await page.evaluate(() => document.documentElement.hasAttribute('data-restoring-home'))).toBe(
        false,
      );
      const canvas = await page.evaluate(
        () => (window as unknown as { __canvasFrames: string[] }).__canvasFrames,
      );
      expect(canvas.length).toBeGreaterThan(0);
      expect(canvas.every((frame) => frame === 'visible:rgb(245, 244, 239)')).toBe(true);
    } finally {
      await page.goto('about:blank');
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}
