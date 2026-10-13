import { useNavigate } from 'react-router-dom'
import SettingItem from '../components/SettingItem.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function SettingsPage() {
  const nav = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { logout } = useAuth()
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-bold">Settings</h1>
      <div className="card divide-y divide-slate-200 overflow-hidden dark:divide-slate-800">
        <SettingItem icon="👤" label="Account" hint="Name, username, email" />
        <SettingItem icon="🔒" label="Privacy" hint="Who can see your activity" onClick={() => nav('/privacy')} />
        <SettingItem icon="🛡️" label="Security" hint="Password and login" />
        <SettingItem icon="🔔" label="Notifications" onClick={() => nav('/notifications')} />
        <SettingItem icon="🚫" label="Blocked Users" onClick={() => nav('/privacy')} />
        <SettingItem icon="❓" label="Help & Support" />
        <SettingItem icon={theme === 'dark' ? '☀️' : '🌙'} label="Theme" hint={`Currently ${theme}. Tap to switch`} onClick={toggleTheme} />
        <SettingItem icon="🚪" label="Logout" danger onClick={async () => { await logout(); nav('/login', { replace: true }) }} />
      </div>
    </div>
  )
}
