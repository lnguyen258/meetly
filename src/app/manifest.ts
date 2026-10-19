import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meetly",
    short_name: "Meetly",
    description: "Find a time that works for everyone, live.",
    start_url: "/home",
    display: "standalone",
    background_color: "#eaeded",
    theme_color: "#131921",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
