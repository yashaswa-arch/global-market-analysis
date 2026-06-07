export function LoadingBlock({ label = "Loading intelligence..." }: { label?: string }) {
  return (
    <div className="status-block" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="status-block status-block--error" role="alert">
      {message}
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return <div className="status-block">{message}</div>;
}
