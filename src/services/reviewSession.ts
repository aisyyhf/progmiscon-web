type ReviewSession = {
  expires_at?: number;
  user: { id: string };
};

type ReviewSessionResult = {
  data: { session: ReviewSession | null };
  error: unknown;
};

export type ReviewAuthClient = {
  getSession: () => Promise<ReviewSessionResult>;
  refreshSession: () => Promise<ReviewSessionResult>;
};

export type ReviewSessionAuthErrorLike = {
  code?: string;
  message?: string;
};

export const REVIEW_SESSION_REFRESH_MARGIN_MS = 90_000;
export const REVIEW_SESSION_EXPIRED_MESSAGE =
  "Sesi login Anda telah berakhir. Draf review disimpan sementara di tab ini. Login kembali, lalu kirim satu kali.";

export class ReviewSessionPreparationError extends Error {
  readonly code = "SESSION_EXPIRED" as const;

  constructor() {
    super(REVIEW_SESSION_EXPIRED_MESSAGE);
    this.name = "ReviewSessionPreparationError";
  }
}

function isAuthenticatedSession(
  session: ReviewSession | null,
): session is ReviewSession {
  return Boolean(session?.user?.id);
}

function needsRefresh(session: ReviewSession, now: number): boolean {
  return (
    typeof session.expires_at !== "number" ||
    session.expires_at * 1000 - now <= REVIEW_SESSION_REFRESH_MARGIN_MS
  );
}

export async function prepareReviewSession(
  auth: ReviewAuthClient,
  now = Date.now(),
): Promise<void> {
  let current: ReviewSessionResult;

  try {
    current = await auth.getSession();
  } catch {
    throw new ReviewSessionPreparationError();
  }

  if (current.error || !isAuthenticatedSession(current.data.session)) {
    throw new ReviewSessionPreparationError();
  }

  if (!needsRefresh(current.data.session, now)) return;

  let refreshed: ReviewSessionResult;

  try {
    refreshed = await auth.refreshSession();
  } catch {
    throw new ReviewSessionPreparationError();
  }

  const refreshedSession = refreshed.data.session;
  if (
    refreshed.error ||
    !isAuthenticatedSession(refreshedSession) ||
    typeof refreshedSession.expires_at !== "number" ||
    refreshedSession.expires_at * 1000 <= now
  ) {
    throw new ReviewSessionPreparationError();
  }
}

export async function withPreparedReviewSession<T>(
  auth: ReviewAuthClient,
  write: () => PromiseLike<T>,
  now = Date.now(),
): Promise<T> {
  await prepareReviewSession(auth, now);
  return await write();
}

export function isReviewSessionAuthError(
  error: ReviewSessionAuthErrorLike,
): boolean {
  if (error.code?.trim().toUpperCase() === "PGRST301") return true;

  const message = error.message?.trim().toLowerCase();
  return message === "jwt expired" || message === "jwt has expired";
}
