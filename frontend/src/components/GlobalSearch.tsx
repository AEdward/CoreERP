"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SearchResult } from "@/lib/api";

const DEBOUNCE_MS = 250;

/** A single search box mounted in the launcher and ModuleShell top bars
 * rather than each module owning its own — see apps.search.GlobalSearchView. Debounces input,
 * shows a grouped-by-module dropdown, and just navigates to the hit's
 * module page (there's no per-record detail route yet to deep-link to). */
export function GlobalSearch({ active }: { active: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const data = await api.globalSearch(value.trim());
      setResults(data);
      setOpen(true);
    }, DEBOUNCE_MS);
  }

  function handleSelect(r: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(r.url);
  }

  if (!active) return null;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", marginRight: 12 }}>
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (results && results.length > 0) setOpen(true);
        }}
        style={{ padding: "6px 10px", fontSize: 13, width: 200 }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 4px)",
            zIndex: 30,
            width: 320,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            textAlign: "left",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {results?.length === 0 && (
            <p style={{ fontSize: 12, color: "#999", padding: 12, margin: 0 }}>No matches.</p>
          )}
          {results?.map((r) => (
            <div
              key={`${r.app_label}.${r.model}.${r.object_id}`}
              onClick={() => handleSelect(r)}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #f5f5f5",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: "#999", fontSize: 10, marginTop: 2 }}>{r.module}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
