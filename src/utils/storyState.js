// Pure helpers to update story groups ({ user, stories, hasUnseen }) after a view or delete
export const markViewed = (groups, id) =>
  groups.map((g) => {
    const stories = g.stories.map((s) => (s.id === id ? { ...s, viewedByMe: true } : s))
    return { ...g, stories, hasUnseen: stories.some((s) => !s.viewedByMe) }
  })

export const removeStory = (groups, id) =>
  groups
    .map((g) => {
      const stories = g.stories.filter((s) => s.id !== id)
      return { ...g, stories, hasUnseen: stories.some((s) => !s.viewedByMe) }
    })
    .filter((g) => g.stories.length > 0)
