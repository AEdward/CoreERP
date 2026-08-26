import shared from "@/styles/shared.module.css";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className={shared.page}>
      <div className={shared.pageHeader}>
        <div>
          <h1 className={shared.pageTitle}>{title}</h1>
        </div>
      </div>
      <div
        className={shared.card}
        style={{ border: "1px dashed var(--brand-400)", maxWidth: 640 }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--brand-600)",
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          Coming soon
        </div>
        <p style={{ margin: 0, color: "var(--gray-600)", fontSize: 14, lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
