import { useState, useEffect } from 'react'
import { getPlatforms, savePlatformConfig } from '../api/client'
import toast from 'react-hot-toast'
import { Facebook, Instagram, Linkedin, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: <Facebook size={22} className="text-blue-600" />,
    color: 'border-blue-200 bg-blue-50',
    fields: [
      { key: 'page_id',      label: 'Page ID',          placeholder: '123456789012345' },
      { key: 'access_token', label: 'Page Access Token', placeholder: 'EAAxxxxx…', secret: true },
      { key: 'page_name',    label: 'Page Name',         placeholder: 'Erin Menard Properties' },
    ],
    setupUrl: 'https://developers.facebook.com/apps',
    setupSteps: [
      'Go to developers.facebook.com → Create App → Business type',
      'Add "Pages" and "Instagram Graph API" products',
      'Use Graph API Explorer to generate a Page Access Token',
      'Exchange for a long-lived token (60-day expiry)',
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: <Instagram size={22} className="text-pink-500" />,
    color: 'border-pink-200 bg-pink-50',
    fields: [
      { key: 'account_id',   label: 'Business Account ID', placeholder: '17841400000000000' },
    ],
    setupUrl: 'https://developers.facebook.com/apps',
    setupSteps: [
      'Connect your Instagram Business account to your Facebook Page',
      'In Graph API Explorer: GET /{page-id}?fields=instagram_business_account',
      'Copy the returned Instagram Business Account ID',
      'Uses the same Page Access Token as Facebook above',
    ],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: <Linkedin size={22} className="text-blue-700" />,
    color: 'border-sky-200 bg-sky-50',
    fields: [
      { key: 'account_id',   label: 'Organization ID (urn:li:organization:XXXXX)', placeholder: 'urn:li:organization:12345678' },
      { key: 'access_token', label: 'Access Token', placeholder: 'AQVxxx…', secret: true },
      { key: 'page_name',    label: 'Organization Page Name', placeholder: 'Erin Menard Properties' },
    ],
    setupUrl: 'https://www.linkedin.com/developers/apps',
    setupSteps: [
      'Create a LinkedIn Developer App at linkedin.com/developers/apps',
      'Request "Share on LinkedIn" and "Marketing Developer Platform" products',
      'Generate a 2-month access token via OAuth 2.0',
      'Find your Organization ID in your Company Page URL or via the API',
    ],
  },
]

export default function PlatformSettings() {
  const [configs, setConfigs] = useState({})
  const [forms, setForms] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => {
    getPlatforms().then(r => {
      setConfigs(r.data)
      const initial = {}
      Object.entries(r.data).forEach(([p, c]) => {
        initial[p] = {
          page_id: c.page_id || '',
          account_id: c.account_id || '',
          access_token: '',
          page_name: c.page_name || '',
        }
      })
      setForms(initial)
    }).catch(console.error)
  }, [])

  const save = async (platformId) => {
    setSaving(s => ({ ...s, [platformId]: true }))
    try {
      const data = { platform: platformId, ...forms[platformId] }
      const res = await savePlatformConfig(platformId, data)
      setConfigs(c => ({ ...c, [platformId]: res.data }))
      toast.success(`${platformId} settings saved`)
    } catch { toast.error('Failed to save') }
    finally { setSaving(s => ({ ...s, [platformId]: false })) }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Connect your social media accounts to enable publishing.</p>
      </div>

      {PLATFORMS.map(platform => {
        const config = configs[platform.id] || {}
        const form = forms[platform.id] || {}
        const isConnected = config.is_connected

        return (
          <div key={platform.id} className={`card border-2 ${platform.color}`}>
            <div className="flex items-center gap-3 mb-5">
              {platform.icon}
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">{platform.name}</h2>
                {config.page_name && <p className="text-sm text-gray-500">{config.page_name}</p>}
              </div>
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <AlertCircle size={16} /> Not connected
                </span>
              )}
            </div>

            {/* Setup guide */}
            <details className="mb-5 bg-white rounded-lg border border-gray-200">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer select-none flex items-center justify-between">
                <span>Setup Instructions</span>
                <ExternalLink size={14} className="text-gray-400" />
              </summary>
              <div className="px-4 pb-4">
                <ol className="space-y-1.5 text-sm text-gray-600 list-decimal list-inside">
                  {platform.setupSteps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
                <a href={platform.setupUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline text-sm mt-3">
                  Open developer portal <ExternalLink size={12} />
                </a>
              </div>
            </details>

            {/* Form fields */}
            <div className="space-y-3">
              {platform.fields.map(field => (
                <div key={field.key}>
                  <label className="label">{field.label}</label>
                  <input
                    className="input bg-white"
                    type={field.secret ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={form[field.key] || ''}
                    onChange={e => setForms(f => ({
                      ...f,
                      [platform.id]: { ...f[platform.id], [field.key]: e.target.value }
                    }))}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => save(platform.id)}
              disabled={saving[platform.id]}
              className="btn-primary text-sm mt-4"
            >
              {saving[platform.id] ? 'Saving…' : `Save ${platform.name} Settings`}
            </button>
          </div>
        )
      })}

      <div className="card bg-amber-50 border-amber-200 border">
        <h3 className="font-semibold text-amber-900 mb-2">Security Note</h3>
        <p className="text-sm text-amber-800">
          Access tokens are stored in the local SQLite database. For production use, consider encrypting tokens at rest
          or using environment variables in <code className="bg-amber-100 px-1 rounded">.env</code> instead.
          Never commit your <code className="bg-amber-100 px-1 rounded">.env</code> file to version control.
        </p>
      </div>
    </div>
  )
}
