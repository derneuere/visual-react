import type { PageTemplate } from "./index";

export const blogPostTemplate: PageTemplate = {
  name: "Blog Post",
  description: "Simple article layout with title and text content",
  content: [
    {
      id: "Page",
      props: {
        instanceId: "template-blog",
        title: "",
        children: [
          {
            id: "Section",
            props: {
              title: "Article",
              instanceId: "template-blog-article",
              children: [
                {
                  id: "Title",
                  props: {
                    label: "Article Title",
                    size: 1,
                    alignment: "left",
                    instanceId: "template-blog-title",
                  },
                },
                {
                  id: "Text",
                  props: {
                    label: "Write your article content here. You can add images, quotes, and more by dragging components from the component explorer.",
                    instanceId: "template-blog-body",
                  },
                },
              ],
              backgroundColor: "secondary",
              alignment: "stretch",
              height: "100%",
              width: "100%",
            },
          },
        ],
      },
    },
  ],
};
