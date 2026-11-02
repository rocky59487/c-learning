/** Text with one phrase highlighted; spaces inside the text are ignored when matching. */
export function Marked({ text, mark }: { text: string; mark?: string }) {
  if (!mark) return <>{text}</>
  const pattern = [...mark.replace(/\s+/g, '')].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')
  const m = new RegExp(pattern).exec(text)
  if (!m) return <>{text}</>
  return (
    <>
      {text.slice(0, m.index)}
      <mark>{m[0]}</mark>
      {text.slice(m.index + m[0].length)}
    </>
  )
}
