export function loader({ request }: { request: Request }) {
  void request
  const body = [
    "User-agent: *",
    "Disallow: /",
    "",
  ].join("\n")

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  })
}
