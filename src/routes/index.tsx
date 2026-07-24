import { createFileRoute, redirect } from "@tanstack/react-router";

// Index redirects into the authenticated dashboard.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
