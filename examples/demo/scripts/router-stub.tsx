import React from "react";

// Stub for @tanstack/react-router used in static export
// Replaces Link with a plain <a> tag
export function Link({
  to,
  children,
  ...rest
}: {
  to: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}

// Re-export anything else components might use as no-ops
export function useRouter() {
  return {};
}

export function useNavigate() {
  return () => {};
}
