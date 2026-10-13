export default function Logo({ size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-9 w-9 text-lg'
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`${box} flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-pink-500 font-bold text-white`}>V</span>
      <span className={`${size === 'lg' ? 'text-4xl' : 'text-xl'} font-extrabold bg-gradient-to-r from-brand-600 to-pink-500 bg-clip-text text-transparent`}>Vibely</span>
    </span>
  )
}
