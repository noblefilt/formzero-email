export function loader({ request }: { request: Request }) {
  void request

  return new Response("Sitemap disabled for this private tool.\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  })
}
