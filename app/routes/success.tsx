import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/success";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Submission Successful" },
    { name: "description", content: "Your form has been submitted successfully" },
  ];
}

export default function Success() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!redirectUrl) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = redirectUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [redirectUrl]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            Submission Successful!
          </h1>
          <p className="text-muted-foreground">
            Thank you for your submission. We have received your information and will get back to you shortly.
          </p>
          {redirectUrl && (
            <p className="mt-4 text-sm text-muted-foreground">
              Redirecting in {countdown} seconds...
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {redirectUrl && (
              <a
                href={redirectUrl}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Redirect Now
              </a>
            )}
            <button
              onClick={handleGoBack}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
