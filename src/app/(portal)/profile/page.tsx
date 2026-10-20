import { pageUser } from '@/lib/auth';
import { profileAction } from '@/app/actions';
import { ActionForm, Field } from '@/components/forms';
import { Heading } from '@/components/ui';
export default async function Profile() {
  const user = await pageUser();
  return <><Heading eyebrow="ACCOUNT SETTINGS" title="Your profile" description="Manage your details and keep your account secure." /><div className="panel" style={{ maxWidth: 660 }}><ActionForm action={profileAction}><Field label="Full name" name="name" value={user.name} required /><p className="muted small">Email: {user.email}. Contact your administrator for email changes.</p><h3 style={{ marginTop: 14 }}>Change password</h3><Field label="Current password" name="currentPassword" type="password" /><Field label="New password" name="newPassword" type="password" hint="Leave blank to keep your password. Changing it signs out other sessions." /></ActionForm></div></>;
}
