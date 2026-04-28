import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center border-b border-border/40 bg-background/95 p-4 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="mr-3 rounded-full p-2 hover:bg-accent"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Privacy Policy</h1>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="space-y-6 text-sm text-foreground/90">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              Welcome to SafiriPod. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy will inform you as to how we look after your personal data when you visit our 
              website and tell you about your privacy rights.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">2. Data We Collect</h2>
            <p>
              We may collect, use, store and transfer different kinds of personal data about you, including:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li><strong>Identity Data:</strong> username, display name, and profile picture.</li>
              <li><strong>Contact Data:</strong> email address.</li>
              <li><strong>Technical Data:</strong> internet protocol (IP) address, browser type and version.</li>
              <li><strong>Usage Data:</strong> information about how you use our platform and interact with posts.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
            <p>
              We will only use your personal data when the law allows us to. Most commonly, we will use your 
              personal data in the following circumstances:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li>To register you as a new user.</li>
              <li>To manage our relationship with you.</li>
              <li>To improve our platform, products/services, marketing, and customer experiences.</li>
              <li>To personalize your feed using our Fair-View Algorithm.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">4. Cookies</h2>
            <p>
              We use cookies and similar tracking technologies to track the activity on our service and hold 
              certain information. You can instruct your browser to refuse all cookies or to indicate when a 
              cookie is being sent.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">5. Your Legal Rights</h2>
            <p>
              Under certain circumstances, you have rights under data protection laws in relation to your 
              personal data, including the right to request access, correction, erasure, restriction, 
              transfer, to object to processing, to portability of data and (where the lawful ground of 
              processing is consent) to withdraw consent.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">6. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our privacy practices, please contact us 
              through our official support channels.
            </p>
          </section>

          <div className="mt-8 pt-6 border-t border-border/40 text-xs text-muted-foreground">
            Last Updated: April 2026
          </div>
        </div>
      </main>
    </div>
  );
}
