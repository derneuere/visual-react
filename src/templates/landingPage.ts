import type { PageTemplate } from "./index";

export const landingPageTemplate: PageTemplate = {
  name: "Landing Page",
  description: "Hero section with title, text, and call-to-action button",
  content: [
    {
      id: "Page",
      props: {
        instanceId: "template-landing",
        title: "",
        children: [
          {
            id: "Section",
            props: {
              title: "Hero",
              instanceId: "template-landing-hero",
              children: [
                {
                  id: "Title",
                  props: {
                    label: "Welcome to Our Site",
                    size: 1,
                    alignment: "center",
                    instanceId: "template-landing-title",
                  },
                },
                {
                  id: "Text",
                  props: {
                    label: "Discover what we have to offer. Build something amazing with our platform.",
                    instanceId: "template-landing-text",
                  },
                },
                {
                  id: "Button",
                  props: {
                    label: "Get Started",
                    instanceId: "template-landing-btn",
                  },
                },
              ],
              backgroundColor: "primary",
              alignment: "center",
              height: "100%",
              width: "100%",
            },
          },
          {
            id: "Section",
            props: {
              title: "Content",
              instanceId: "template-landing-content",
              children: [
                {
                  id: "Title",
                  props: {
                    label: "Features",
                    size: 2,
                    alignment: "center",
                    instanceId: "template-landing-features-title",
                  },
                },
                {
                  id: "Text",
                  props: {
                    label: "Add your content here. Describe your features, services, or products.",
                    instanceId: "template-landing-features-text",
                  },
                },
              ],
              backgroundColor: "secondary",
              alignment: "center",
              height: "100%",
              width: "100%",
            },
          },
        ],
      },
    },
  ],
};
