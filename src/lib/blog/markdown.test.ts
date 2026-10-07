import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./markdown";

describe("markdownToHtml basePath links", () => {
  it("prefixes root-relative hrefs with the app basePath", async () => {
    const html = await markdownToHtml("[Calculator](/)");
    expect(html).toContain('href="/tiktok"');
    expect(html).not.toContain('href="/tiktok/"');
  });

  it("prefixes nested internal links", async () => {
    const html = await markdownToHtml("[US fees](/us/tiktok-shop-fees)");
    expect(html).toContain('href="/tiktok/us/tiktok-shop-fees"');
  });

  it("leaves external links untouched", async () => {
    const html = await markdownToHtml("[Seller Center](https://seller-us.tiktok.com/x)");
    expect(html).toContain('href="https://seller-us.tiktok.com/x"');
  });

  it("does not double-prefix", async () => {
    const html = await markdownToHtml("[Blog](/tiktok/blog)");
    expect(html).toContain('href="/tiktok/blog"');
    expect(html).not.toContain('/tiktok/tiktok');
  });
});
