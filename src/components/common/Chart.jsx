// Grafik batang sederhana berbasis SVG — ringan tanpa dependensi
import { rupiah } from '../../utils/format'

export default function BarChart({ data, height = 220, format = rupiah }) {
  // data: [{ label, value }]
  const max = Math.max(1, ...data.map((d) => d.value))
  const barW = 100 / Math.max(1, data.length)
  return (
    <div className="barchart" style={{ height }}>
      <div className="barchart-grid">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="barchart-line" style={{ bottom: `${f * 100}%` }}>
            <span className="barchart-val">{format(max * f)}</span>
          </div>
        ))}
      </div>
      <div className="barchart-bars">
        {data.map((d, i) => (
          <div key={i} className="barchart-col" style={{ width: `${barW}%` }} title={`${d.label}: ${format(d.value)}`}>
            <div className="barchart-bar" style={{ height: `${(d.value / max) * 100}%` }}>
              <span className="barchart-tip">{format(d.value)}</span>
            </div>
            <span className="barchart-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
