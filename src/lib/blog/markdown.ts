import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";
import { BASE_PATH } from "../site/config";

function rehypeBasePathLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (href === BASE_PATH || href.startsWith(`${BASE_PATH}/`)) return;
      node.properties.href = `${BASE_PATH}${href}`;
    });
  };
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize)
    .use(rehypeBasePathLinks)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}