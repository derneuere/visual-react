import type { Instance } from "../registry/types";

export interface PageTemplate {
  name: string;
  description: string;
  content: Instance[];
}

export { blankTemplate } from "./blankPage";
export { landingPageTemplate } from "./landingPage";
export { blogPostTemplate } from "./blogPost";

import { blankTemplate } from "./blankPage";
import { landingPageTemplate } from "./landingPage";
import { blogPostTemplate } from "./blogPost";

/** All built-in templates. */
export const builtInTemplates: PageTemplate[] = [
  blankTemplate,
  landingPageTemplate,
  blogPostTemplate,
];

/** Prefix used for user-saved templates in the storage system. */
export const TEMPLATES_FOLDER = "_templates";
