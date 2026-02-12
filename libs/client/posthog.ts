type PostHogLike = {
  capture?: (eventName: string, properties?: Record<string, unknown>) => void;
};

type EventProperties = Record<string, unknown>;

const MAX_STACK_LENGTH = 2000;

const getPostHog = (): PostHogLike | null => {
  if (typeof window === "undefined") return null;
  return ((window as Window & { posthog?: PostHogLike }).posthog || null) as PostHogLike | null;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: (error.stack || "").slice(0, MAX_STACK_LENGTH) || null,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack: null,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown client error",
    stack: null,
  };
};

export const capturePosthogEvent = (
  eventName: string,
  properties: EventProperties = {}
) => {
  const posthog = getPostHog();
  if (!posthog?.capture) return false;

  try {
    posthog.capture(eventName, properties);
    return true;
  } catch (captureError) {
    console.error("[posthog][capture-failed]", captureError);
    return false;
  }
};

export const capturePosthogError = ({
  source,
  error,
  context = {},
}: {
  source: string;
  error: unknown;
  context?: EventProperties;
}) => {
  const normalized = normalizeError(error);
  return capturePosthogEvent("client_error_captured", {
    source,
    error_name: normalized.name,
    error_message: normalized.message,
    error_stack: normalized.stack,
    path: typeof window !== "undefined" ? window.location.pathname : null,
    href: typeof window !== "undefined" ? window.location.href : null,
    ...context,
  });
};

