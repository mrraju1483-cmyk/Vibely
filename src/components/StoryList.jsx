import Avatar from './Avatar.jsx'

const ring = (on) => `rounded-full p-0.5 ${on ? 'bg-gradient-to-tr from-brand-600 to-pink-500' : 'bg-slate-300 dark:bg-slate-700'}`
const focus = 'rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

// groups: [{ user, stories, hasUnseen }]. onOpen(groupIndex) opens the viewer, onAdd() opens the composer.
export default function StoryList({ groups, me, onOpen, onAdd }) {
  const mineIndex = groups.findIndex((g) => g.user.id === me.id)
  return (
    <ul className="flex gap-4 overflow-x-auto pb-2" aria-label="Stories">
      <li className="flex flex-col items-center gap-1">
        <div className="relative">
          <button type="button" className={focus} aria-label={mineIndex >= 0 ? 'View your story' : 'Add to your story'} onClick={() => (mineIndex >= 0 ? onOpen(mineIndex) : onAdd())}>
            <span className={ring(mineIndex >= 0)}><span className="block rounded-full border-2 border-white dark:border-slate-950"><Avatar name={me.fullName} src={me.profilePhoto} size="h-14 w-14" /></span></span>
          </button>
          <button type="button" aria-label="Add to your story" onClick={onAdd}
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-950">+</button>
        </div>
        <span className="text-xs">Your story</span>
      </li>
      {groups.map((g, i) => g.user.id === me.id ? null : (
        <li key={g.user.id}>
          <button type="button" className={`flex flex-col items-center gap-1 ${focus}`} aria-label={`${g.user.username}'s story${g.hasUnseen ? ', new' : ''}`} onClick={() => onOpen(i)}>
            <span className={ring(g.hasUnseen)}><span className="block rounded-full border-2 border-white dark:border-slate-950"><Avatar name={g.user.fullName} src={g.user.profilePhoto} size="h-14 w-14" /></span></span>
            <span className="max-w-[4.5rem] truncate text-xs">{g.user.username}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
