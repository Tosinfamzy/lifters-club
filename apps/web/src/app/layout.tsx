import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "@/providers/user-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifters Club",
  description: "Training decision engine for strength athletes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#3B82F6",
          colorBackground: "#0F172A",
          colorInputBackground: "#1E293B",
          colorInputText: "#F8FAFC",
          colorText: "#F8FAFC",
          colorTextSecondary: "#94A3B8",
        },
        elements: {
          formButtonPrimary: "bg-primary hover:bg-primary/90",
          card: "bg-card",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "bg-secondary border-border",
          formFieldLabel: "text-foreground",
          formFieldInput: "bg-input border-border text-foreground",
          footerActionLink: "text-primary hover:text-primary/90",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className="min-h-screen bg-background text-foreground antialiased">
          <UserProvider>{children}</UserProvider>
          <Toaster theme="dark" richColors closeButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
