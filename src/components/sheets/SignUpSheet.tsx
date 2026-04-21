import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Mail } from "lucide-react";
import { useState } from "react";

export function SignUpSheet() {
  const { showSignUp, closeSignUp, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"start" | "otp">("start");

  return (
    <Sheet open={showSignUp} onOpenChange={(o) => !o && closeSignUp()}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>Join travelpod</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Sign in to like, comment, save to Trip Boards, and message creators & businesses.
          </p>

          {step === "start" ? (
            <>
              <button
                onClick={signIn}
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

              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => email && setStep("otp")}
                  disabled={!email}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40"
                >
                  <Mail className="h-4 w-4" /> Continue with email
                </button>
              </div>

              <button
                onClick={closeSignUp}
                className="block w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Continue browsing as guest
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">
                We sent a 6-digit code to <span className="font-semibold">{email}</span>.
              </p>
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                className="w-full rounded-full border border-border bg-muted px-4 py-3 text-center text-lg tracking-[0.5em] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={signIn}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                Verify & continue
              </button>
              <button
                onClick={() => setStep("start")}
                className="block w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </>
          )}
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
