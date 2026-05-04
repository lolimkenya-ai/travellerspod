import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Loader2, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { z } from "zod";
import { toast } from "sonner";

/** Detect common in-app browsers (Telegram, WhatsApp, Instagram, FB, Line, etc.) where Google OAuth gets stuck. */
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|Instagram|Line|Twitter|WhatsApp|Telegram|TikTok|Snapchat|MicroMessenger|MiuiBrowser|; wv\)/i.test(ua);
}

const credSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  display_name: z.string().trim().min(1, "Required").max(60).optional(),
});

type Mode = "choose" | "signup" | "signin";

export function SignUpSheet() {
  const { showSignUp, closeSignUp, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business" | "organization">("personal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inApp = useMemo(() => isInAppBrowser(), []);

  function handleGoogle() {
    if (inApp) {
      try { navigator.clipboard?.writeText(window.location.href); } catch { /* noop */ }
      toast.error("Open in your browser", {
        description: "Google sign-in doesn't work in in-app browsers. Tap the ⋮ menu → 'Open in browser' (link copied).",
        duration: 8000,
      });
      return;
    }
    signInWithGoogle();
  }

  function reset() {
    setMode("choose");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setErr(null);
    setBusy(false);
  }

  async function handleSubmit() {
    setErr(null);
    const parse = credSchema.safeParse({
      email,
      password,
      display_name: mode === "signup" ? displayName : undefined,
    });
    if (!parse.success) {
      setErr(parse.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const res =
      mode === "signup"
        ? await signUpWithEmail(email, password, {
            display_name: displayName || email.split("@")[0],
            account_type: accountType,
          })
        : await signInWithEmail(email, password);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      // If sign-up bounced because the email exists, flip to sign-in so the user
      // can just hit the button again with the same password.
      if (mode === "signup" && /already|sign in/i.test(res.error)) {
        setMode("signin");
      }
    } else {
      reset();
    }
  }

  return (
    <Sheet open={showSignUp} onOpenChange={(o) => { if (!o) { closeSignUp(); reset(); } }}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>{mode === "signin" ? "Sign in to Safiripod" : "Join Safiripod"}</SheetTitle>
          <SheetDescription className="sr-only">
            Create an account or sign in to access all features.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          {mode === "choose" && (
            <p className="text-sm text-muted-foreground">
              Sign in to like, comment, save to Trip Boards, and message creators & businesses.
            </p>
          )}

          {mode === "signup" && (
            <>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                maxLength={60}
                className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                {(["personal", "business", "organization"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccountType(t)}
                    className={`flex-1 rounded-full border px-2 py-2 text-xs font-semibold capitalize transition-colors ${
                      accountType === t
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode !== "choose" && (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {err && <p className="text-xs text-destructive">{err}</p>}
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
              {mode === "signin" && (
                <a
                  href="/reset-password"
                  onClick={() => { closeSignUp(); reset(); }}
                  className="block text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </a>
              )}
            </>
          )}

          {mode === "choose" ? (
            <div className="flex flex-col gap-3">
              {inApp && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Open in your browser to sign in with Google</p>
                    <p className="mt-0.5 opacity-90">
                      You're using an in-app browser. Tap the ⋮ menu and choose "Open in browser" — or use email sign-in below.
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                  <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                  <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                  <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                </svg>
                Continue with Google
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <button
                onClick={() => setMode("signup")}
                className="w-full rounded-full border border-border py-3 text-sm font-semibold text-foreground hover:bg-accent"
              >
                Sign up with email
              </button>
              <button
                onClick={() => setMode("signin")}
                className="w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Already have an account? Sign in
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="block w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          )}

          <button
            onClick={() => { closeSignUp(); reset(); }}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Continue browsing as guest
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
