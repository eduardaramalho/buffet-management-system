export type BarChartItem = { label: string; value: number; color?: string }

type BarChartProps = {
  title: string
  items: BarChartItem[]
  /** Fixed scale (e.g. 100 for percentages); defaults to the largest value. */
  max?: number
  format?: (value: number) => string
}

/** Horizontal bar chart in plain HTML/CSS: no chart library, accessible as a labelled list of values. */
export function BarChart({ title, items, max, format = String }: BarChartProps) {
  const scale = max ?? Math.max(0, ...items.map((item) => item.value))
  return <figure className="bar-chart" aria-label={title}>
    <figcaption>{title}</figcaption>
    {scale === 0
      ? <p className="empty-state">Sem dados no período.</p>
      : <ul>{items.map((item) => <li key={item.label}>
        <span className="bar-label">{item.label}</span>
        <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.round((item.value / scale) * 100)}%`, ...(item.color ? { background: item.color } : {}) }} /></span>
        <strong className="bar-value">{format(item.value)}</strong>
      </li>)}</ul>}
  </figure>
}
