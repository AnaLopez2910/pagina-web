import Link from "next/link";

import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return <main className="container-page flex min-h-screen items-center justify-center py-12"><section className="panel sparkle-bg w-full max-w-md bg-white/90 p-8"><Link href="/" className="font-display text-center text-2xl font-black text-brand block">Oli Shop</Link><div className="mt-8"><LoginForm /></div></section></main>;
}
