// Grant or revoke the admin role. This is the ONLY way to create an admin (there is no API for it).
//   npm run admin:grant -- someone@example.com
//   npm run admin:revoke -- someone@example.com
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'

const [action, rawEmail] = process.argv.slice(2)
if (!['grant', 'revoke'].includes(action) || !rawEmail) {
  console.error('Usage: node scripts/set-admin.js <grant|revoke> <email>')
  process.exit(1)
}

await mongoose.connect(env.mongoUri)
const user = await User.findOne({ email: rawEmail.trim().toLowerCase() })
let code = 0
if (!user) { console.error('No account with that email.'); code = 1 }
else if (action === 'grant') {
  if (!user.isActive || !user.isVerified) { console.error('The account must be verified and active first.'); code = 1 }
  else { user.role = 'admin'; await user.save(); console.log(`${user.username} is now an admin.`) }
} else {
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', isActive: true })) <= 1) { console.error('Refusing to remove the last admin.'); code = 1 }
  else { user.role = 'user'; await user.save(); console.log(`${user.username} is no longer an admin.`) }
}
await mongoose.disconnect()
process.exit(code)
