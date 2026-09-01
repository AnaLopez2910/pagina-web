"use client";
/* eslint-disable @next/next/no-img-element */

import { Check, Copy, ImagePlus, Images, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getPublicImageUrl } from "@/lib/storage";
import type { CategoryRow, StoreRow } from "@/types/database";

type AdminCategory = CategoryRow & {
  imageUrl: string | null;
  _count: { products: number };
};

type HeroDraft = {
  path: string;
  preview: string;
  file: File | null;
};

function formatInteger(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("es-AR") : "";
}

function unformatInteger(value: string) {
  return value.replace(/\D/g, "");
}

function emptyHeroDraft(store: StoreRow): HeroDraft[] {
  return Array.from({ length: 3 }, (_, index) => {
    const path = store.hero_image_paths?.[index] ?? "";
    return { path, preview: path ? getPublicImageUrl(path) : "", file: null };
  });
}

function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4">
      <span>
        <span className="block font-black">{label}</span>
        <span className="mt-1 block text-sm font-semibold text-muted">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#bd6f84]" : "bg-[#e7dfe1]"}`}>
        <input className="sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

export function StoreSettingsForm({ store, initialCategories }: { store: StoreRow; initialCategories: AdminCategory[] }) {
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description ?? "");
  const [phone, setPhone] = useState(store.whatsapp_phone);
  const [heroTitle, setHeroTitle] = useState(store.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(store.hero_subtitle ?? "");
  const [address, setAddress] = useState(store.address ?? "");
  const [heroDrafts, setHeroDrafts] = useState<HeroDraft[]>(() => emptyHeroDraft(store));
  const [logoPath, setLogoPath] = useState(store.logo_path ?? "");
  const [logoPreview, setLogoPreview] = useState(store.logo_path ? getPublicImageUrl(store.logo_path) : "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [showCategories, setShowCategories] = useState(store.show_categories);
  const [mobileProductColumns, setMobileProductColumns] = useState<1 | 2>(store.mobile_product_columns === 1 ? 1 : 2);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(store.free_shipping_enabled);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(formatInteger(store.free_shipping_threshold || 35000));
  const [loading, setLoading] = useState(false);
  const [categoryLoadingId, setCategoryLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const publicPath = `/${store.slug}`;

  useEffect(() => () => {
    heroDrafts.forEach((draft) => {
      if (draft.file && draft.preview.startsWith("blob:")) URL.revokeObjectURL(draft.preview);
    });
  }, [heroDrafts]);

  useEffect(() => () => {
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  async function copyUrl() {
    await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function chooseHeroImage(index: number, file: File | undefined) {
    if (!file) return;
    setHeroDrafts((current) => current.map((draft, draftIndex) => {
      if (draftIndex !== index) return draft;
      if (draft.file && draft.preview.startsWith("blob:")) URL.revokeObjectURL(draft.preview);
      return { path: "", preview: URL.createObjectURL(file), file };
    }));
  }

  function clearHeroImage(index: number) {
    setHeroDrafts((current) => current.map((draft, draftIndex) => {
      if (draftIndex !== index) return draft;
      if (draft.file && draft.preview.startsWith("blob:")) URL.revokeObjectURL(draft.preview);
      return { path: "", preview: "", file: null };
    }));
  }

  async function saveCategoryImage(category: AdminCategory, file: File | null) {
    setCategoryLoadingId(category.id);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("imagePath", file ? category.image_path ?? "" : "");
    if (file) form.set("imageFile", file);
    const response = await fetch(`/api/admin/categories/${category.id}`, { method: "PATCH", body: form });
    const data = await response.json().catch(() => null);
    setCategoryLoadingId(null);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo guardar la imagen de la categoría.");
      return;
    }
    setCategories(data.categories ?? categories);
    setMessage("Imagen de categoría actualizada.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("name", name);
    form.set("description", description);
    form.set("whatsappPhone", phone);
    form.set("heroTitle", heroTitle);
    form.set("heroSubtitle", heroSubtitle);
    form.set("address", address);
    form.set("showCategories", String(showCategories));
    form.set("mobileProductColumns", String(mobileProductColumns));
    form.set("freeShippingEnabled", String(freeShippingEnabled));
    form.set("freeShippingThreshold", unformatInteger(freeShippingThreshold));
    form.set("restrictBySchedule", String(store.restrict_by_schedule));
    form.set("businessHours", JSON.stringify(store.business_hours));
    form.set("logoPath", logoPath);
    heroDrafts.forEach((draft, index) => {
      form.set(`heroImagePath${index}`, draft.path);
      if (draft.file) form.set(`heroImageFile${index}`, draft.file);
    });
    if (logoFile) form.set("logoFile", logoFile);

    const response = await fetch("/api/admin/store", { method: "PATCH", body: form });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "No se pudo guardar la configuración.");
      setLoading(false);
      return;
    }

    const nextStore = data?.store as StoreRow | undefined;
    if (nextStore) {
      setLogoPath(nextStore.logo_path ?? "");
      setLogoFile(null);
      setLogoPreview(nextStore.logo_path ? getPublicImageUrl(nextStore.logo_path) : "");
      setHeroDrafts(emptyHeroDraft(nextStore));
      setShowCategories(nextStore.show_categories);
      setMobileProductColumns(nextStore.mobile_product_columns === 1 ? 1 : 2);
      setFreeShippingEnabled(nextStore.free_shipping_enabled);
      setFreeShippingThreshold(formatInteger(nextStore.free_shipping_threshold));
    }
    setMessage("Cambios guardados.");
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-5 pb-24">
      <section className="panel grid gap-5 bg-white/85 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#bd6f84]">Identidad</p>
          <h2 className="mt-1 text-2xl font-black">Así se ve tu marca</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="grid gap-3">
            <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[28px] bg-gradient-to-br from-blush to-lilac shadow-soft">
              {logoPreview ? <img src={logoPreview} alt={`Logo de ${name}`} className="h-full w-full object-cover" /> : <span className="font-display text-5xl font-black text-[#bd6f84]">{name.slice(0, 1).toUpperCase() || "A"}</span>}
            </div>
            <label className="btn-secondary cursor-pointer">
              <ImagePlus size={17} /> {logoPreview ? "Cambiar logo" : "Subir logo"}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  setLogoFile(file);
                  if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
                  setLogoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
          <div className="grid gap-4">
            <label className="grid gap-2"><span className="font-black">Nombre de la marca</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>
            <label className="grid gap-2"><span className="font-black">Descripción</span><textarea className="field min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Pestañas, maquillaje y pequeños rituales de belleza." /></label>
          </div>
        </div>
      </section>

      <section className="panel grid gap-5 bg-white/85 p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#bd6f84]">Página pública</p>
          <h2 className="mt-1 text-2xl font-black">Tu escaparate online</h2>
          <p className="mt-2 text-sm text-muted">La página usa la plantilla Beauty Store y estos datos para completar su contenido.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2"><span className="font-black">Título principal</span><input className="field" value={heroTitle} onChange={(event) => setHeroTitle(event.target.value)} maxLength={120} placeholder="Brillá a tu manera" /></label>
          <label className="grid gap-2"><span className="font-black">Subtítulo</span><input className="field" value={heroSubtitle} onChange={(event) => setHeroSubtitle(event.target.value)} maxLength={220} placeholder="Tus favoritos de belleza, listos para vos." /></label>
        </div>
        <label className="grid gap-2"><span className="font-black">Dirección o zona de retiro</span><input className="field" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={180} placeholder="Palermo, Buenos Aires" /></label>

        <div className="grid gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-black"><Images size={18} className="text-[#bd6f84]" /> Imágenes del hero</h3>
            <p className="mt-1 text-sm text-muted">Podés cargar hasta tres imágenes. Se mostrarán en un carrusel automático.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {heroDrafts.map((draft, index) => (
              <div key={index} className="grid gap-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-dashed border-[#d9b4c0] bg-[#fdf2f4]">
                  {draft.preview ? <img src={draft.preview} alt={`Imagen del hero ${index + 1}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-center text-sm font-bold text-muted">Imagen {index + 1}<br />Opcional</div>}
                  {draft.preview ? <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#9f566b] shadow" onClick={() => clearHeroImage(index)} type="button" aria-label={`Quitar imagen del hero ${index + 1}`}><X size={16} /></button> : null}
                </div>
                <label className="btn-secondary cursor-pointer !px-3 !py-2 text-sm">
                  <ImagePlus size={15} /> {draft.preview ? "Cambiar" : "Agregar"}
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => chooseHeroImage(index, event.currentTarget.files?.[0])} />
                </label>
              </div>
            ))}
          </div>
        </div>

        <Toggle checked={showCategories} onChange={setShowCategories} label="Mostrar sección Categorías" description="Controla las tarjetas visuales de categorías en la página pública." />

        {showCategories ? <div className="grid gap-3">
          <div>
            <h3 className="font-black">Imágenes de categorías</h3>
            <p className="mt-1 text-sm text-muted">Las categorías actuales se mantienen sincronizadas con tu catálogo.</p>
          </div>
          <div className="grid gap-3">
            {categories.length ? categories.map((category) => (
              <article className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3" key={category.id}>
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#fdf2f4] text-xs font-bold text-muted">
                  {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={18} />}
                </div>
                <div className="min-w-0 flex-1"><p className="font-black">{category.name}</p><p className="text-sm text-muted">{category._count.products} producto(s)</p></div>
                <label className="btn-secondary cursor-pointer !px-3 !py-2 text-sm">
                  <ImagePlus size={15} /> {categoryLoadingId === category.id ? "Subiendo..." : category.imageUrl ? "Cambiar" : "Agregar"}
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={categoryLoadingId === category.id} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void saveCategoryImage(category, file); }} />
                </label>
                {category.imageUrl ? <button className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-600" type="button" disabled={categoryLoadingId === category.id} onClick={() => void saveCategoryImage(category, null)} aria-label={`Quitar imagen de ${category.name}`}><Trash2 size={16} /></button> : null}
              </article>
            )) : <p className="rounded-2xl bg-[#fdf2f4] p-4 text-sm font-semibold text-muted">Todavía no hay categorías creadas.</p>}
          </div>
        </div> : null}

        <div className="grid gap-3">
          <h3 className="font-black">Productos por fila en mobile</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((columns) => (
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${mobileProductColumns === columns ? "border-[#bd6f84] bg-[#fdf2f4]" : "border-line bg-white"}`} key={columns}>
                <input type="radio" name="mobileProductColumns" value={columns} checked={mobileProductColumns === columns} onChange={() => setMobileProductColumns(columns as 1 | 2)} />
                <span><span className="block font-black">{columns} producto{columns === 1 ? "" : "s"} por fila</span><span className="text-sm text-muted">En pantallas mobile.</span></span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <Toggle checked={freeShippingEnabled} onChange={setFreeShippingEnabled} label="Mostrar envío gratis" description="Muestra el aviso superior y el progreso hacia el monto mínimo." />
          {freeShippingEnabled ? <label className="grid gap-2 sm:max-w-sm"><span className="font-black">Monto mínimo para envío gratis</span><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black">$</span><input className="field !pl-9" inputMode="numeric" value={freeShippingThreshold} onChange={(event) => setFreeShippingThreshold(formatInteger(event.target.value))} required placeholder="35.000" /></div></label> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4"><span className="min-w-0 flex-1 truncate text-sm font-bold text-muted">{publicPath}</span><button type="button" className="btn-secondary !px-3 !py-2" onClick={copyUrl}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiada" : "Copiar"}</button></div>
      </section>

      <section className="panel grid gap-5 bg-white/85 p-6">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#bd6f84]">Pedidos</p><h2 className="mt-1 text-2xl font-black">Datos de contacto</h2></div>
        <label className="grid gap-2"><span className="font-black">WhatsApp del negocio</span><input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="1123456789 o 541123456789" /></label>
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}{message ? <p className="flex items-center gap-2 text-sm font-bold text-[#bd6f84]"><Sparkles size={16} /> {message}</p> : null}
        <button className="btn-primary w-full sm:w-auto sm:justify-self-start" disabled={loading}>{loading ? "Guardando..." : "Guardar cambios"}</button>
      </section>
    </form>
  );
}
