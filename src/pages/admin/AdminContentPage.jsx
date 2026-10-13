import { useState } from 'react'
import { Badge, FilterSelect, ListFooter } from '../../components/admin/AdminBits.jsx'
import ReasonModal from '../../components/admin/ReasonModal.jsx'
import { usePagedList, useDebounced } from '../../hooks/usePagedList.js'
import { adminListApi, adminRemoveContentApi } from '../../api/adminApi.js'
import { timeAgo } from '../../utils/time.js'

const TABS = [['posts', 'Posts'], ['reels', 'Reels'], ['comments', 'Comments']]

export default function AdminContentPage() {
  const [kind, setKind] = useState('posts')
  const [commentKind, setCommentKind] = useState('post')
  const [q, setQ] = useState('')
  const [target, setTarget] = useState(null)
  const dq = useDebounced(q)
  const list = usePagedList(async (cursor) => {
    const d = await adminListApi(kind, { q: dq || undefined, kind: kind === 'comments' ? commentKind : undefined, cursor: cursor || undefined })
    return { list: d.items, nextCursor: d.nextCursor }
  }, [kind, commentKind, dq])

  const label = kind === 'comments' ? 'comment' : kind === 'reels' ? 'reel' : 'post'
  async function remove(reason) {
    await adminRemoveContentApi(kind, target.id, reason, kind === 'comments' ? commentKind : undefined)
    list.setItems((rows) => rows.filter((r) => r.id !== target.id))
    setTarget(null)
  }

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-2">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setQ('') }} className={`btn ${kind === k ? 'bg-brand-600 text-white' : 'btn-ghost'}`}>{l}</button>)}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-[2]">
          <label htmlFor="admin-content-search" className="mb-1 block text-xs font-medium text-slate-500">{kind === 'comments' ? 'Search comment text' : 'Search caption or #hashtag'}</label>
          <input id="admin-content-search" type="search" className="field" maxLength={50} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {kind === 'comments' && <FilterSelect id="admin-comment-kind" label="Comments on" value={commentKind} onChange={setCommentKind} options={[['post', 'Posts'], ['reel', 'Reels']]} />}
      </div>

      <ul className="space-y-2">
        {list.items.map((it) => (
          <li key={it.id} className="card flex gap-3 p-3">
            {kind !== 'comments' && (
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
                {it.mediaType === 'video' ? <video src={it.mediaUrl} preload="metadata" muted className="h-full w-full object-cover" /> : <img src={it.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-200">@{it.author.username}</span><span>{timeAgo(it.createdAt)} ago</span>
                {it.openReports > 0 && <Badge tone="red">{it.openReports} open report{it.openReports > 1 ? 's' : ''}</Badge>}
                {it.visibility && it.visibility !== 'public' && <Badge>{it.visibility}</Badge>}
                {it.isReply && <Badge>reply</Badge>}
              </p>
              <p className="line-clamp-3 break-words text-sm">{(kind === 'comments' ? it.text : it.caption) || <em className="text-slate-400">No caption</em>}</p>
              {kind !== 'comments' && <p className="text-xs text-slate-500">❤️ {it.likesCount} · 💬 {it.commentsCount}</p>}
              <button type="button" className="btn border border-red-300 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950" onClick={() => setTarget(it)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <ListFooter list={list} emptyTitle="Nothing found" emptyText="No content matches your search." />

      {target && <ReasonModal title={`Remove this ${label}`} confirmLabel="Remove" danger onClose={() => setTarget(null)} onSubmit={remove}
        description={`This permanently deletes the ${label}${kind !== 'comments' ? ' with its comments, likes and media' : ' and any replies'}. Open reports about it are closed.`} />}
    </div>
  )
}
