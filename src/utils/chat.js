export const convTitle = (c) => (c.type === 'group' ? c.name : c.other?.user.fullName || 'Chat')
export const convPhoto = (c) => (c.type === 'group' ? c.photo : c.other?.user.profilePhoto)
export const fileSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
export const DISAPPEAR_OPTIONS = [[0, 'Off'], [86400, '24 hours'], [604800, '7 days'], [7776000, '90 days']]
export const disappearLabel = (s) => (DISAPPEAR_OPTIONS.find(([v]) => v === s) || [0, ''])[1]
