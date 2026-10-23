// Captcha visual 5 karakter (angka & huruf tanpa karakter mirip)
// Parent yang memegang kode agar bisa divalidasi saat submit
export default function Captcha({ code, onRefresh }) {
  return (
    <div className="captcha" onClick={onRefresh} title="Klik untuk ganti kode" role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRefresh()}>
      <div className="captcha-code" aria-label="Kode captcha">
        {String(code)
          .split('')
          .map((ch, i) => (
            <span
              key={i}
              style={{
                transform: `rotate(${((i * 37) % 21) - 10}deg) translateY(${((i * 13) % 7) - 3}px)`,
                fontWeight: 700 + ((i * 3) % 3) * 100,
                fontStyle: i % 2 ? 'italic' : 'normal',
              }}
            >
              {ch}
            </span>
          ))}
      </div>
      <span className="captcha-refresh" aria-hidden="true">↻</span>
    </div>
  )
}
