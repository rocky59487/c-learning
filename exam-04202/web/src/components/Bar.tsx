/** Thin progress line with the 60% pass mark; used under the top bar. */
export function Bar({ value }: { value: number }) {
  return (
    <div className="topline" aria-hidden="true">
      <i style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
    </div>
  )
}
