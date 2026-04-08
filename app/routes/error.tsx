import type { Route } from "./+types/error";

const errorMessages = {
  form_not_found: {
    title: "Form Not Found",
    description: "The form you are trying to submit to does not exist.",
  },
  internal_error: {
    title: "Internal Error",
    description: "An error occurred while processing your submission.",
  },
  unsupported_content_type: {
    title: "Unsupported Content Type",
    description: "The content type of your request is not supported.",
  },
  rate_limited: {
    title: "Too Many Requests",
    description: "You are submitting too frequently. Please try again later.",
  },
} as const;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Error - FormZero" },
    { name: "description", content: "An error occurred while processing your request." },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const errorType = url.searchParams.get("error") as keyof typeof errorMessages | null;

  const errorData = errorType && errorMessages[errorType]
    ? errorMessages[errorType]
    : errorMessages.internal_error;

  return { errorData };
}

export default function Error({ loaderData }: Route.ComponentProps) {
  const { errorData } = loaderData;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {errorData.title}
          </h1>
          <p className="text-muted-foreground">
            {errorData.description}
          </p>
          <div className="mt-6">
            <a
              href="javascript:history.back()"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Go Back
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
