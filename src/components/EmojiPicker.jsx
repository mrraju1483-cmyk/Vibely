const EMOJIS = ['😀', '😂', '🥹', '😍', '😘', '😎', '🤩', '🥳', '😅', '😭', '😡', '🤔', '🙄', '😴', '🤗', '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🔥', '✨', '💯', '🎉', '❤️', '💜', '💔', '🥰', '☕', '🍕', '🎧', '🎬', '🌅', '🌈', '✈️', '🏖️', '📷', '💬']

// Small built-in picker. Swap for a full emoji library later without changing the composer.
export default function EmojiPicker({ onPick }) {
  return (
    <div role="group" aria-label="Emoji picker" className="grid grid-cols-8 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {EMOJIS.map((e) => (
        <button key={e} type="button" aria-label={`Insert ${e}`} onClick={() => onPick(e)} className="rounded-lg p-1 text-xl hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800">{e}</button>
      ))}
    </div>
  )
}
