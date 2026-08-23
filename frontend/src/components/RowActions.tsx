"use client";

/** Shared Edit/Delete button pair for a table row — used by every module
 * page that has edit/delete UI. Delete always confirms first since it's
 * not undoable from the UI. */
export function RowActions({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit?: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          style={{ padding: "2px 8px", fontSize: 12 }}
        >
          Edit
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this? This can't be undone.")) onDelete();
        }}
        disabled={disabled}
        style={{ padding: "2px 8px", fontSize: 12, color: "crimson" }}
      >
        Delete
      </button>
    </span>
  );
}
