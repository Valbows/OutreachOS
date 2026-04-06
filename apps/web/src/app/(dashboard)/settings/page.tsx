"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Modal, Select, Switch } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

type SettingsTab = "profile" | "inbox" | "notifications" | "danger";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <ProfileIcon /> },
  { id: "inbox", label: "Inbox Connection", icon: <InboxIcon /> },
  { id: "notifications", label: "Notifications", icon: <NotificationsIcon /> },
  { id: "danger", label: "Danger Zone", icon: <DangerIcon /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Manage your OS
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab navigation */}
        <nav className="lg:w-56 shrink-0">
          <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-[var(--radius-button)] transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="[&>svg]:w-5 [&>svg]:h-5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile" && <ProfileSection />}
          {activeTab === "inbox" && <InboxSection />}
          {activeTab === "notifications" && <NotificationsSection />}
          {activeTab === "danger" && <DangerSection />}
        </div>
      </div>
    </div>
  );
}

/* --- Profile Section --- */
function ProfileSection() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [name, setName] = useState("");
  // TODO: Add `company` column to accounts schema and wire to API
  const [company, setCompany] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
    }
  }, [session?.user]);

  const avatarInitial = name.trim().charAt(0).toUpperCase() || "?";

  async function handleProfileSave() {
    setProfileError(null);
    setProfileSuccess(false);

    if (!name.trim()) {
      setProfileError("Full name is required.");
      return;
    }

    setProfileSaving(true);
    try {
      const { error } = await authClient.updateUser({ name: name.trim() });
      if (error) {
        setProfileError(error.message || "Failed to update profile.");
      } else {
        setProfileSuccess(true);
      }
    } catch {
      setProfileError("An unexpected error occurred.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordUpdate() {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) {
        setPasswordError(error.message || "Failed to update password.");
      } else {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (sessionLoading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-on-surface-variant">Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-surface-container-highest flex items-center justify-center text-xl font-semibold text-primary">
              {avatarInitial}
            </div>
            <div>
              <Button variant="secondary" size="sm">
                Upload Photo
              </Button>
              <p className="text-xs text-outline mt-1">
                JPG, GIF or PNG. Max size of 800K
              </p>
            </div>
          </div>

          {profileError && (
            <div className="px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="px-4 py-3 bg-secondary/10 border border-secondary/20 rounded-[var(--radius-input)] text-sm text-secondary">
              Profile updated successfully.
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => { setName(e.target.value); setProfileSuccess(false); }}
            />
            <Input
              label="Email"
              type="email"
              value={session?.user?.email ?? ""}
              disabled
            />
          </div>
          <Input
            label="Company"
            value={company}
            onChange={(e) => { setCompany(e.target.value); setProfileSuccess(false); }}
            placeholder="Your company name"
          />

          <div className="flex justify-end">
            <Button onClick={handleProfileSave} disabled={profileSaving}>
              {profileSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security &amp; Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordError && (
            <div className="px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="px-4 py-3 bg-secondary/10 border border-secondary/20 rounded-[var(--radius-input)] text-sm text-secondary">
              Password updated successfully.
            </div>
          )}

          <Input
            label="Current password"
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setPasswordSuccess(false); }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="New password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false); }}
            />
            <Input
              label="Confirm password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSuccess(false); }}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handlePasswordUpdate} disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* --- Inbox Connection Section --- */
function InboxSection() {
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function handleGoogleConnect() {
    setOauthPending(true);
    setOauthError(null);
    try {
      const { error } = await authClient.signIn.social({ provider: "google" });
      if (error) {
        setOauthError("Failed to connect Google account. Please try again.");
        setOauthPending(false);
      }
    } catch (error) {
      setOauthError("Failed to connect Google account. Please try again.");
      setOauthPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* IMAP/SMTP Config */}
      <Card>
        <CardHeader>
          <CardTitle>IMAP/SMTP Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-on-surface-variant mb-2">
            Custom Server Auth
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="IMAP Host" placeholder="imap.gmail.com" />
            <Input label="IMAP Port" placeholder="993" type="number" />
            <Input label="SMTP Host" placeholder="smtp.gmail.com" />
            <Input label="SMTP Port" placeholder="587" type="number" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Username" placeholder="you@gmail.com" />
            <Input label="Password" type="password" placeholder="App-specific password" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="tls" defaultChecked className="accent-primary" />
            <label htmlFor="tls" className="text-sm text-on-surface-variant">
              Use TLS/SSL
            </label>
          </div>
          <div className="flex justify-end">
            <Button>Save Connection</Button>
          </div>
        </CardContent>
      </Card>

      {/* OAuth */}
      <Card>
        <CardHeader>
          <CardTitle>One-Click Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant mb-4">
            Connect your Google Workspace or Personal Gmail via OAuth 2.0.
          </p>
          {oauthError && (
            <div className="mb-4 px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
              {oauthError}
            </div>
          )}
          <Button variant="secondary" onClick={handleGoogleConnect} disabled={oauthPending}>
            <GoogleIcon />
            {oauthPending ? "Connecting..." : "Connect Google Account"}
          </Button>
        </CardContent>
      </Card>

      {/* LLM Preference */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Preference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select label="Primary LLM Provider" defaultValue="gemini">
            <option value="gemini">Gemini 2.5 Pro (default)</option>
            <option value="openrouter">OpenRouter (auto-route)</option>
          </Select>
          <Input label="Default Sender Domain" placeholder="outreach.yourcompany.com" />
          <div className="flex justify-end">
            <Button>Save Preferences</Button>
          </div>
        </CardContent>
      </Card>

      {/* BYOK */}
      <Card>
        <CardHeader>
          <CardTitle>BYOK — Bring Your Own Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-outline mb-2">
            Keys are AES-256 encrypted at rest. Raw keys are never logged.
          </p>
          <Input label="Hunter.io API Key" type="password" placeholder="Enter key or leave blank for platform key" />
          <Input label="Resend API Key" type="password" placeholder="Enter key or leave blank for platform key" />
          <Input label="Gemini API Key" type="password" placeholder="Enter key or leave blank for platform key" />
          <Input label="OpenRouter API Key" type="password" placeholder="Enter key or leave blank for platform key" />
          <div className="flex justify-end">
            <Button>Save Keys</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* --- Notifications Section --- */
function NotificationsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ToggleRow
          label="Campaign Events"
          description="Notify me when a sequence is completed or paused."
          defaultChecked
        />
        <ToggleRow
          label="Bounce Thresholds"
          description="Alert me if bounce rates exceed 2.5% on any sender."
          defaultChecked
        />
        <ToggleRow
          label="System Intelligence"
          description="Weekly AI summaries of campaign performance and sentiment."
          defaultChecked={false}
        />
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-on-surface">{label}</p>
        <p className="text-xs text-outline mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={setChecked}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

/* --- Danger Zone Section --- */
function DangerSection() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmValid = confirmText === "DELETE";

  async function handleDeleteAccount() {
    if (!confirmValid) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await authClient.deleteUser();
    } catch {
      setDeleteError("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  function closeModal() {
    if (deleting) return;
    setShowDeleteModal(false);
    setConfirmText("");
    setDeleteError(null);
  }

  return (
    <>
      <Card className="border border-error/20">
        <CardHeader>
          <CardTitle className="text-error">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-on-surface-variant">
            Irreversible administrative actions
          </p>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-on-surface">
                Export All Platform Data
              </p>
              <p className="text-xs text-outline mt-0.5">
                Download all campaign logs, prospect lists, and analytical history
                as a JSON/CSV bundle.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0">
              Export
            </Button>
          </div>

          <div className="h-px bg-outline-variant/10" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-error">
                Terminate Account
              </p>
              <p className="text-xs text-outline mt-0.5">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="shrink-0"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showDeleteModal}
        onClose={closeModal}
        title="Confirm Account Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            This will permanently delete your account, all campaigns, contacts,
            templates, and analytics data.{" "}
            <strong className="text-error">This cannot be undone.</strong>
          </p>

          {deleteError && (
            <div className="px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
              {deleteError}
            </div>
          )}

          <div>
            <label
              htmlFor="confirm-delete"
              className="text-sm font-medium text-on-surface-variant mb-1.5 block"
            >
              Type <span className="font-mono text-error">DELETE</span> to confirm
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="w-full px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-[var(--radius-input)] border-b-2 border-transparent placeholder:text-outline focus:border-b-error focus:outline-none transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModal} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={!confirmValid || deleting}
            >
              {deleting ? "Deleting..." : "Permanently Delete Account"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* --- Icons --- */

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  );
}

function DangerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
