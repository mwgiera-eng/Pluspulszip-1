import { Link } from "wouter";
import React from "react";

interface SafeLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

const isUnsafeHref = (href: string) => {
  if (!href) return false;
  const h = href.trim().toLowerCase();
  return h.startsWith("javascript:") || h.startsWith("data:") || h.startsWith("vbscript:");
};

export function SafeLink({ href, children, ...rest }: SafeLinkProps) {
  // External absolute links
  const isExternal = /^(https?:)?\/\//i.test(href);

  if (isUnsafeHref(href)) {
    // Render inert element and warn — do not follow unsafe hrefs
    return (
      // eslint-disable-next-line jsx-a11y/anchor-is-valid
      <a
        {...rest}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          console.warn("Blocked unsafe navigation to:", href);
        }}
        rel="noreferrer noopener"
      >
        {children}
      </a>
    );
  }

  if (isExternal) {
    return (
      <a {...rest} href={href} target={rest.target ?? "_blank"} rel="noreferrer noopener">
        {children}
      </a>
    );
  }

  // Internal link — use wouter Link for SPA navigation
  return (
    <Link href={href} {...(rest as any)}>
      {children}
    </Link>
  );
}
