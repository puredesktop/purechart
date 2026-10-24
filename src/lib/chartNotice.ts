/** Conservative wrapping for 11px SVG notices, including unbroken words. */
export function wrapNotice(text: string, width: number): string[] {
  const limit = Math.max(1, Math.floor(width / 6.6))
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line)
      line = ''
    }
    if (word.length > limit) {
      for (let at = 0; at < word.length; at += limit) lines.push(word.slice(at, at + limit))
    } else line += `${line ? ' ' : ''}${word}`
  }
  if (line) lines.push(line)
  return lines
}
