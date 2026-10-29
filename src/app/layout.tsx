import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "منيو مطعم الزيتونة | اطلب من طاولتك مباشرة",
  description: "المنيو الرقمي الذكي لمطعم الزيتونة - استعرض الأطباق واطلب مباشرة من طاولتك",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-cairo bg-cream-100 text-stone-900 antialiased min-h-screen">
        {children}
        <Toaster
          position="top-center"
          dir="rtl"
          richColors
          toastOptions={{
            style: {
              fontFamily: "var(--font-cairo)",
            },
          }}
        />
      </body>
    </html>
  );
}
