import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://docs.clashforai.dev",
  integrations: [
    starlight({
      title: "Clash for AI Docs",
      description: "Documentation for Clash for AI, a local desktop gateway for switching AI relay providers behind one stable endpoint.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/xiaoyuandev/clash-for-ai"
        }
      ],
      sidebar: [
        {
          label: "Get Started",
          items: [
            { slug: "introduction" },
            { slug: "quick-start" },
            { slug: "tool-integration" }
          ]
        },
        {
          label: "Reference",
          items: [{ slug: "providers" }, { slug: "faq" }]
        }
      ]
    })
  ]
});
