export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.replace("_", "-")}`}>
      <span aria-hidden="true" className="badge-dot" />
      {value.replaceAll("_", " ")}
    </span>
  );
}
