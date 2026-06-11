const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const hljs = require("highlight.js");

// Configuration: whether external links should open in a new tab
const EXTERNAL_LINKS_NEW_TAB = true;

module.exports = function (eleventyConfig) {
  // Ignore internal documentation folder
  eleventyConfig.ignores.add("_internal/**");

  // Pass through index.html unchanged (custom landing page)
  eleventyConfig.addPassthroughCopy("index.html");

  // Copy images folder
  eleventyConfig.addPassthroughCopy("images");

  // Configure markdown with anchor plugin for heading ids
  const slugify = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

  const md = markdownIt({
    html: true,
    linkify: true,
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch (__) {}
      }
      return "";
    },
  }).use(markdownItAnchor, {
    permalink: false,
    level: [1, 2, 3, 4],
    slugify: slugify,
  });

  // Configure external links to open in new tab if enabled
  if (EXTERNAL_LINKS_NEW_TAB) {
    const defaultLinkOpen =
      md.renderer.rules.link_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const hrefIndex = tokens[idx].attrIndex("href");
      if (hrefIndex >= 0) {
        const href = tokens[idx].attrs[hrefIndex][1];
        // Only add target="_blank" for external links (not relative or anchor links)
        if (href.startsWith("http://") || href.startsWith("https://")) {
          tokens[idx].attrPush(["target", "_blank"]);
          tokens[idx].attrPush(["rel", "noopener noreferrer"]);
        }
      }
      return defaultLinkOpen(tokens, idx, options, env, self);
    };
  }

  eleventyConfig.setLibrary("md", md);

  // Sitemap generation
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const fs = require("fs");
    const path = require("path");
    const hostname = "https://slack-simulator.dev"; // Replace with actual domain

    const urls = [];

    // Add all HTML files to sitemap
    const addFiles = (dirPath, baseUrl) => {
      const files = fs.readdirSync(dirPath);
      files.forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          addFiles(filePath, baseUrl + file + "/");
        } else if (file.endsWith(".html")) {
          const url = baseUrl + file.replace("index.html", "");
          urls.push({ url: hostname + url, lastmod: new Date().toISOString() });
        }
      });
    };

    addFiles(dir.output, "/");

    // Generate sitemap XML
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.url}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    fs.writeFileSync(path.join(dir.output, "sitemap.xml"), sitemapXml);

    // Generate robots.txt
    const robotsTxt = `User-agent: *
Allow: /
Sitemap: ${hostname}/sitemap.xml`;

    fs.writeFileSync(path.join(dir.output, "robots.txt"), robotsTxt);

    // Generate llm.txt
    const llmTxt = `# Slack Simulator

Slack Simulator is a local, browser-based simulator for developing and testing Slack apps and bots.

## Purpose
The simulator provides a local development environment for Slack app developers to:
- Test Slack apps without installing them into a real workspace
- Iterate quickly without network dependencies
- Debug events, interactivity payloads, and Web API calls
- Switch between mock users to test multi-user conversations

## Key Features
- Local-only operation (no internet required)
- SQLite-backed persistence with reset capability
- Support for HTTP webhooks and Socket Mode
- Block Kit renderer for interactive components
- Built-in debugging tools (logs, database inspector)

## Documentation
- Get Started: ${hostname}/get-started/
- Product Spec: ${hostname}/product-spec/
- Tech Spec: ${hostname}/tech-spec/
- Capabilities: ${hostname}/capabilities/

## Stack
- Backend: Node.js, TypeScript, Fastify, SQLite
- Frontend: React, Vite, Tailwind CSS
- Documentation: Eleventy`;

    fs.writeFileSync(path.join(dir.output, "llm.txt"), llmTxt);
  });

  // Transform: rewrite .md links to directory-style URLs for web output
  eleventyConfig.addTransform("md-links-to-html", function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      // Convert .md hrefs to absolute directory-style URLs
      // e.g., capabilities.md -> /capabilities/, ../capabilities.md -> /capabilities/
      return content.replace(/href="([^"]+\.md)"/g, (match, href) => {
        // Convert to absolute path by removing ../ and prepending /
        const absolutePath = href
          .replace(/^\.\.?\//, "/")
          .replace(/^([^/])/, "/$1");
        const dirPath = absolutePath.replace(/\.md$/, "/");
        return `href="${dirPath}"`;
      });
    }
    return content;
  });

  // Add TOC shortcode - extract headings using the shared slugify function
  // Optional parameter: includeLevels (array of heading levels to include, e.g., [1,2,3])
  eleventyConfig.addShortcode(
    "toc",
    function (content, includeLevels = [2, 3]) {
      const tokens = md.parse(content, {});
      const headings = [];

      tokens.forEach((token) => {
        if (token.type === "heading_open") {
          const level = parseInt(token.tag.substring(1));
          const nextToken = tokens[tokens.indexOf(token) + 1];
          if (nextToken && nextToken.type === "inline") {
            const text = nextToken.content;
            const slug = slugify(text);
            headings.push({ level, text, slug });
          }
        }
      });

      // Filter by included levels
      const filteredHeadings = headings.filter((h) =>
        includeLevels.includes(h.level),
      );

      let html = '<nav class="toc-list">';
      filteredHeadings.forEach((heading) => {
        html += `<a href="#${heading.slug}" class="toc-item level-${heading.level}">${heading.text}</a>`;
      });
      html += "</nav>";
      return html;
    },
  );

  // Output directory
  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
    },
  };
};
