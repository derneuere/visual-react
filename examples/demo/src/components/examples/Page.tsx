import React from "react";
const Page = ({ children }) => <>{children}</>;
export default Page;

export const metadata = {
  name: "Page",
  defaultProps: {
    children: [],
  },
  editableProps: {
    children: "componentlist",
  },
};
