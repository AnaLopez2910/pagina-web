"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const SETTINGS_PATH = "/gestion/configuracion";
const UNSAVED_CHANGES_MESSAGE = "Tenés cambios sin guardar. ¿Querés salir sin guardar los cambios?";

type UnsavedChangesContextValue = {
  confirmNavigation: () => boolean;
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (pathname !== SETTINGS_PATH) {
      hasUnsavedChangesRef.current = false;
    }
  }, [pathname]);

  const confirmNavigation = useCallback(() => {
    if (!hasUnsavedChangesRef.current) {
      return true;
    }

    const shouldLeave = window.confirm(UNSAVED_CHANGES_MESSAGE);
    if (shouldLeave) {
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
    }
    return shouldLeave;
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChangesRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        !hasUnsavedChangesRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target || target.hasAttribute("download") || target.target === "_blank") {
        return;
      }

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const destination = new URL(href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname && destination.search === window.location.search)
      ) {
        return;
      }

      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmNavigation]);

  return (
    <UnsavedChangesContext.Provider value={{ confirmNavigation, setHasUnsavedChanges }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges debe usarse dentro de UnsavedChangesProvider");
  }
  return context;
}
