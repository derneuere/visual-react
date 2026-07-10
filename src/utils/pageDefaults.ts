import { Instance } from "../registry/types";
import type { PageData } from "../storage/types";
import { createDefaultMeta } from "../storage/migration";

export function createDefaultPageData(title = "New Page"): PageData {
  const content: Instance[] = [
    {
      id: "Page",
      props: {
        instanceId: crypto.randomUUID(),
        title,
        children: [
          {
            id: "Section",
            props: {
              title: "",
              instanceId: crypto.randomUUID(),
              children: [],
              backgroundColor: "secondary",
              alignment: "center",
              height: "100%",
              width: "100%",
              noPadding: true,
            },
          },
        ],
      },
    },
  ];

  return {
    meta: createDefaultMeta(title),
    content,
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
