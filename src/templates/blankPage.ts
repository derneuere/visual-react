import type { PageTemplate } from "./index";

export const blankTemplate: PageTemplate = {
  name: "Blank Page",
  description: "An empty page with a single section",
  content: [
    {
      id: "Page",
      props: {
        instanceId: "template-blank",
        title: "",
        children: [
          {
            id: "Section",
            props: {
              title: "",
              instanceId: "template-blank-section",
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
  ],
};
