"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") });
    if (authError) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.replace("/gestion");
    router.refresh();
  }

  return <form onSubmit={onSubmit} className="space-y-4"><input className="field" name="email" type="email" placeholder="Email" autoComplete="email" required /><input className="field" name="password" type="password" placeholder="Contraseña" autoComplete="current-password" required />{error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}<button className="btn-primary w-full" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button></form>;
}

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` });
    if (resetError) setError("No se pudo enviar el correo de recuperación.");
    else setMessage("Si el correo existe, vas a recibir un enlace para cambiar la contraseña.");
    setLoading(false);
  }

  return <form onSubmit={onSubmit} className="space-y-4"><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email de administración" autoComplete="email" required />{error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}{message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}<button className="btn-primary w-full" disabled={loading}>{loading ? "Enviando..." : "Enviar enlace"}</button></form>;
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError("No se pudo actualizar la contraseña.");
      setLoading(false);
      return;
    }
    router.replace("/gestion");
    router.refresh();
  }

  return <form onSubmit={onSubmit} className="space-y-4"><input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña" autoComplete="new-password" minLength={8} required />{error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}<button className="btn-primary w-full" disabled={loading}>{loading ? "Guardando..." : "Actualizar contraseña"}</button></form>;
}
