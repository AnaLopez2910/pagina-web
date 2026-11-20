"use client";
/* eslint-disable @next/next/no-img-element */

import { Check, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useLockBodyScroll } from "@/components/use-lock-body-scroll";

type Category = {
  id: string;
  name: string;
  image_path: string | null;
  imageUrl: string | null;
  _count: { products: number };
};

function productCount(count: number) {
  return count === 1 ? "1 producto" : `${count} productos`;
}

export function CategoryManager({ categories: initialCategories }: { categories: Category[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useLockBodyScroll(Boolean(pendingDelete));

  async function request(url: string, init: RequestInit, fallbackError: string) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? fallbackError);
        return null;
      }
      return data ?? {};
    } catch {
      setError("No se pudo conectar. Intentá nuevamente.");
      return null;
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2) {
      setError("El nombre tiene que tener al menos 2 letras.");
      return;
    }
    setCreating(true);
    const data = await request("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }, "No se pudo crear la categoría.");
    setCreating(false);
    if (!data) return;
    setCategories(data.categories);
    setNewName("");
    setMessage(`Se creó «${name}».`);
    router.refresh();
  }

  async function renameCategory(category: Category) {
    const name = editingName.trim();
    if (name === category.name) {
      setEditingId(null);
      return;
    }
    if (name.length < 2) {
      setError("El nombre tiene que tener al menos 2 letras.");
      return;
    }
    setBusyId(category.id);
    const data = await request(`/api/admin/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }, "No se pudo renombrar la categoría.");
    setBusyId(null);
    if (!data) return;
    setCategories(data.categories);
    setEditingId(null);
    setMessage(`Ahora se llama «${name}».`);
    router.refresh();
  }

  async function saveImage(category: Category, file: File | null) {
    setBusyId(category.id);
    const form = new FormData();
    if (file) form.set("imageFile", file);
    form.set("imagePath", file ? category.image_path ?? "" : "");
    const data = await request(`/api/admin/categories/${category.id}`, { method: "PATCH", body: form }, "No se pudo guardar la foto de la categoría.");
    setBusyId(null);
    if (!data) return;
    setCategories(data.categories);
    setMessage(file ? `Foto de «${category.name}» actualizada.` : `Se quitó la foto de «${category.name}».`);
    router.refresh();
  }

  async function deleteCategory(category: Category) {
    setBusyId(category.id);
    const data = await request(`/api/admin/categories/${category.id}`, { method: "DELETE" }, "No se pudo eliminar la categoría.");
    setBusyId(null);
    if (!data) return;
    setCategories((current) => current.filter((item) => item.id !== category.id));
    setPendingDelete(null);
    setMessage(`Se eliminó «${category.name}».`);
    router.refresh();
  }

  return (
    <section className="panel overflow-hidden">
      <form className="flex gap-2 border-b border-line p-3 sm:p-4" onSubmit={createCategory}>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nombre de la nueva categoría</span>
          <input className="field !min-h-12" placeholder="Nueva categoría, por ejemplo «Uñas»" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} disabled={creating} />
        </label>
        <button className="btn-primary !min-h-12 shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={creating}>
          <Plus size={17} /> {creating ? "Creando…" : "Crear"}
        </button>
      </form>

      {error && !pendingDelete ? <p className="border-b border-line bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="border-b border-line bg-green-50 p-4 text-sm font-semibold text-green-800" role="status">{message}</p> : null}

      {categories.length ? (
        <ul className="divide-y divide-line">
          {categories.map((category) => {
            const busy = busyId === category.id;
            const editing = editingId === category.id;
            return (
              <li key={category.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface text-muted sm:h-16 sm:w-16">
                  {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={20} aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void renameCategory(category); }}>
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Nuevo nombre de {category.name}</span>
                        <input className="field !min-h-10 !rounded-xl !py-2" value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={80} autoFocus disabled={busy} />
                      </label>
                      <button className="btn-primary !h-10 !w-10 shrink-0 !rounded-xl !p-0" type="submit" aria-label="Guardar nombre" disabled={busy}><Check size={18} /></button>
                      <button className="btn-secondary !h-10 !w-10 shrink-0 !rounded-xl !p-0" type="button" aria-label="Cancelar" onClick={() => setEditingId(null)} disabled={busy}><X size={18} /></button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate font-black">{category.name}</p>
                      <p className="text-sm text-muted">{productCount(category._count.products)}{busy ? " · Guardando…" : ""}</p>
                    </>
                  )}
                </div>
                {!editing ? (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                    <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-sm" type="button" onClick={() => { setEditingId(category.id); setEditingName(category.name); setError(""); }} disabled={busy}>
                      <Pencil size={15} /> Renombrar
                    </button>
                    <label className={`btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-sm ${busy ? "pointer-events-none opacity-60" : ""}`}>
                      <ImagePlus size={15} /> {category.imageUrl ? "Cambiar foto" : "Agregar foto"}
                      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ""; if (file) void saveImage(category, file); }} />
                    </label>
                    {category.imageUrl ? <button className="btn-secondary !min-h-10 !rounded-xl !px-3 !py-2 text-sm" type="button" onClick={() => void saveImage(category, null)} disabled={busy}>Quitar foto</button> : null}
                    <button className="btn-secondary !min-h-10 !w-10 !rounded-xl !border-red-200 !p-0 !text-red-700" type="button" aria-label={`Eliminar ${category.name}`} onClick={() => { setError(""); setPendingDelete(category); }} disabled={busy}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-5">
          <p className="font-bold">Todavía no hay categorías.</p>
          <p className="mt-1 text-sm text-muted">Creá la primera arriba, o desde un producto al elegir su categoría.</p>
        </div>
      )}

      {pendingDelete ? <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => { if (!busyId) setPendingDelete(null); }}>
        <section className="panel grid w-full max-w-md gap-4 rounded-b-none p-5 sm:rounded-2xl sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="category-delete-title" aria-describedby="category-delete-text" onClick={(event) => event.stopPropagation()}>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-700" aria-hidden="true"><Trash2 size={20} /></span>
          <div>
            <h2 id="category-delete-title" className="text-xl font-black">¿Eliminar «{pendingDelete.name}»?</h2>
            <p id="category-delete-text" className="mt-1 text-sm text-muted">
              {pendingDelete._count.products
                ? `Sus ${productCount(pendingDelete._count.products)} no se borran: quedan sin categoría.`
                : "No tiene productos."}
            </p>
          </div>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
          <div className="grid gap-2 border-t border-line pt-4 sm:flex sm:justify-end">
            <button className="btn-primary min-h-11 !rounded-xl !bg-red-700 !bg-none disabled:opacity-60 sm:order-2" type="button" onClick={() => void deleteCategory(pendingDelete)} disabled={Boolean(busyId)}>
              <Trash2 size={17} /> {busyId ? "Eliminando…" : "Eliminar categoría"}
            </button>
            <button className="btn-secondary min-h-11 !rounded-xl !border-transparent sm:order-1" type="button" onClick={() => setPendingDelete(null)} disabled={Boolean(busyId)}>Cancelar</button>
          </div>
        </section>
      </div> : null}
    </section>
  );
}
