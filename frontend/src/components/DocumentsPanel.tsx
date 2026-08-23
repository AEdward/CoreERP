"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type Document, type DocumentTarget } from "@/lib/api";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Self-contained "Files" button + expandable panel — list/upload/delete
 * attachments for one record. Works against any target the backend's
 * apps.documents.registry whitelists; the caller just names which
 * record. Same generic-across-modules shape as RowActions. */
export function DocumentsPanel({ target, canManage }: { target: DocumentTarget; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Document[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setDocs(await api.listDocuments(target));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load files.");
    }
  }

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target.appLabel, target.model, target.objectId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(target, file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this file? This can't be undone.")) return;
    try {
      await api.deleteDocument(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete file.");
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ padding: "2px 8px", fontSize: 12 }}
      >
        Files{docs && docs.length > 0 ? ` (${docs.length})` : ""}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 20,
            width: 280,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 12,
            textAlign: "left",
          }}
        >
          {docs === null && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Loading…</p>}
          {docs?.length === 0 && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>No files yet.</p>}
          {docs && docs.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 200, overflowY: "auto" }}>
              {docs.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 0",
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 12,
                  }}
                >
                  <a
                    href={api.documentDownloadUrl(d.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                    title={`${d.original_name} (${formatSize(d.size_bytes)})`}
                  >
                    {d.original_name}
                  </a>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      style={{ padding: "1px 6px", fontSize: 11, color: "crimson" }}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <input
              ref={fileInputRef}
              type="file"
              disabled={uploading}
              onChange={handleUpload}
              style={{ marginTop: 8, fontSize: 11, width: "100%" }}
            />
          )}
          {error && <p style={{ color: "crimson", fontSize: 11, marginTop: 6 }}>{error}</p>}
        </div>
      )}
    </span>
  );
}
