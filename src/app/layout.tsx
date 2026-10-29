import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  variable: "--font-tajawal",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "شاشة استلام الطلبات الواردة | مطعم الزيتونة",
  description: "لوحة موظفي الصالة والمطبخ لإدارة واستلام طلبات المطعم الفورية في مصر",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`}>
      <body className="font-cairo bg-cream-100 text-stone-900 antialiased min-h-screen">
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
