import React from "react";
import { useComponentRegistry } from "../../registry/hooks";
import { useDocumentTitle } from "@mantine/hooks";
import { ComponentRenderer } from "../../components/ComponentRenderer";

interface CurrentPageProps {
  notEditable?: boolean;
}

export const CurrentPage: React.FC<CurrentPageProps> = ({ notEditable }) => {
  const { currentPage: tree } = useComponentRegistry();

  useDocumentTitle(tree && tree.length ? tree[0].props.title : "Loading...");

  if (!tree || !tree.length) {
    return null;
  }

  const children = tree[0].props.children;
  if (!children || !children.length) {
    return null;
  }

  return <ComponentRenderer items={children} notEditable={notEditable} />;
};