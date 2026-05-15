import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "PCA Auth",
  description: "Browser login for PCA CLI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
