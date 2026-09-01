"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LayoutDashboard, LogOut, Menu, Package, Settings, Store, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { useLockBodyScroll } from "@/components/use-lock-body-scroll";
import { createClient } from "@/lib/supabase/client";

function linkClass(pathname: string, href: string) {
  const isActive = href === "/gestion" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return `rounded-2xl px-3 py-3 font-bold transition ${isActive ? "bg-green-50 text-brand" : "hover:bg-surface"}`;
}

function NavContent({ pathname, storeSlug, onNavigate }: { pathname: string; storeSlug: string; onNavigate?: () => void }) {
  const { confirmNavigation } = useUnsavedChanges();
  const router = useRouter();

  return (
    <>
      <Link href="/gestion" className="mb-6 flex items-center gap-2 px-2 text-xl font-black">
        <Store className="text-brand" /> Gestión
      </Link>
      <nav className="grid gap-2">
        <Link className={linkClass(pathname, "/gestion")} href="/gestion" onClick={onNavigate}>
          <LayoutDashboard className="mr-2 inline" size={18} /> Resumen
        </Link>
        <Link className={linkClass(pathname, "/gestion/pedidos")} href="/gestion/pedidos" onClick={onNavigate}>
          <ClipboardList className="mr-2 inline" size={18} /> Pedidos
        </Link>
        <Link className={linkClass(pathname, "/gestion/productos")} href="/gestion/productos" onClick={onNavigate}>
          <Package className="mr-2 inline" size={18} /> Productos
        </Link>
        <Link className={linkClass(pathname, "/gestion/configuracion")} href="/gestion/configuracion" onClick={onNavigate}>
          <Settings className="mr-2 inline" size={18} /> Configuración
        </Link>
        <Link className="rounded-2xl px-3 py-3 font-bold text-brand hover:bg-green-50" href={`/${storeSlug}`} onClick={onNavigate}>
          Ver tienda pública
        </Link>
        <button
          className="rounded-2xl px-3 py-3 text-left font-bold text-red-600 hover:bg-red-50"
          onClick={() => {
            if (confirmNavigation()) {
              void createClient().auth.signOut().then(() => {
                router.replace("/");
                router.refresh();
              });
            }
          }}
          type="button"
        >
          <LogOut className="mr-2 inline" size={18} /> Salir
        </button>
      </nav>
    </>
  );
}

export function AdminNav({ storeSlug }: { storeSlug: string }) {
  const pathname = usePathname();
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [bodyScrollLocked, setBodyScrollLocked] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const openFrameRef = useRef<number | null>(null);
  useLockBodyScroll(menuMounted);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (openFrameRef.current) {
        window.cancelAnimationFrame(openFrameRef.current);
      }
    };
  }, []);

  const shouldHideMobileNav = (navHidden || (bodyScrollLocked && !menuMounted)) && !menuOpen;

  useEffect(() => {
    function syncBodyScrollLock() {
      const isLocked = Number(document.body.dataset.scrollLockCount ?? "0") > 0;
      setBodyScrollLocked(isLocked);
      if (isLocked && !menuMounted) {
        setNavHidden(true);
      } else if (!isLocked) {
        setNavHidden(false);
      }
    }

    syncBodyScrollLock();
    window.addEventListener("body-scroll-lock-change", syncBodyScrollLock);
    return () => window.removeEventListener("body-scroll-lock-change", syncBodyScrollLock);
  }, [menuMounted]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function handleScroll() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;

        if (menuOpen || currentY <= 24) {
          setNavHidden(false);
        } else if (bodyScrollLocked) {
          setNavHidden(true);
        } else if (currentY > 80 && delta > 8) {
          setNavHidden(true);
        } else if (delta < -8) {
          setNavHidden(false);
        }

        lastY = currentY;
        ticking = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [bodyScrollLocked, menuOpen]);

  function openMenu() {
    setNavHidden(false);
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setMenuMounted(true);
    openFrameRef.current = window.requestAnimationFrame(() => setMenuOpen(true));
  }

  function closeMenu() {
    if (openFrameRef.current) {
      window.cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
    setMenuOpen(false);
    closeTimeoutRef.current = window.setTimeout(() => {
      setMenuMounted(false);
      closeTimeoutRef.current = null;
    }, 300);
  }

  return (
    <>
      <div className={`panel sticky top-4 z-30 flex items-center justify-between p-3 transition-transform duration-300 ease-out lg:hidden ${shouldHideMobileNav ? "-translate-y-[calc(100%+24px)]" : "translate-y-0"}`}>
        <Link href="/gestion" className="flex items-center gap-2 text-lg font-black">
          <Store className="text-brand" /> Gestión
        </Link>
        <button className="rounded-full border border-line p-2" type="button" onClick={openMenu} aria-label="Abrir menú de gestión">
          <Menu size={20} />
        </button>
      </div>

      <aside className="panel hidden h-fit p-4 lg:sticky lg:top-6 lg:block">
        <NavContent pathname={pathname} storeSlug={storeSlug} />
      </aside>

      {menuMounted ? (
        <div
          className={`fixed inset-0 z-50 bg-slate-950/45 transition-opacity duration-300 ease-out lg:hidden ${menuOpen ? "opacity-100" : "opacity-0"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de gestión"
        >
          <div className={`grid h-[100dvh] w-full grid-rows-[auto_1fr] bg-white p-4 shadow-2xl transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="mb-4 flex justify-end">
              <button className="rounded-full border border-line p-2" type="button" onClick={closeMenu} aria-label="Cerrar menú de gestión">
                <X size={18} />
              </button>
            </div>
            <div>
              <NavContent pathname={pathname} storeSlug={storeSlug} onNavigate={closeMenu} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
