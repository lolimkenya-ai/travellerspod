import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

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
          <SheetTitle>{mode === "signin" ? "Sign in to travelpod" : "Join travelpod"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-5">
          {mode === "choose" && (
            <p className="text-sm text-muted-foreground">
              Sign in to like, comment, save to Trip Boards, and message creators & businesses.
            </p>
          )}

          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-foreground py-3 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

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
            </>
          )}

          {mode === "choose" ? (
            <div className="flex flex-col gap-2">
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

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-2H12z" />
    </svg>
  );
}
