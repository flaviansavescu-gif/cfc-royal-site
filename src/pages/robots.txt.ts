import type { APIRoute } from "astro";
import { SITE } from "../data/site";

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL(SITE.domain);
  const sitemap = new URL("sitemap-index.xml", base).href;
  const body = `User-agent: *
Allow: /

Sitemap: ${sitemap}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
