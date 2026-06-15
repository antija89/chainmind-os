import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, CheckCircle, ExternalLink } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const PROVIDERS = {
  gemini: {
    label: '🔵 Google Gemini',
    description: 'Google Gemini API — Fast and cost-effective',
    defaultModel: 'gemini-2.0-flash',
    docsLabel: 'Google AI Studio',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    label: '⚫ OpenAI (GPT)',
    description: 'OpenAI GPT models — Powerful and reliable',
    defaultModel: 'gpt-4o',
    docsLabel: 'OpenAI Platform',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: '🟠 Anthropic (Claude)',
    description: 'Anthropic Claude — Advanced reasoning',
    defaultModel: 'claude-3-5-sonnet-20241022',
    docsLabel: 'Anthropic Console',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  custom: {
    label: '⚙️ Custom Endpoint',
    description: 'Any OpenAI-compatible LLM endpoint',
    defaultModel: '',
    docsLabel: 'Your provider docs',
    docsUrl: '#',
  },
} as const;

type Provider = keyof typeof PROVIDERS;

export default function Settings() {
  const [provider, setProvider] = useState<Provider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('gemini-2.0-flash');
  const [saved, setSaved] = useState(false);

  const saveMutation = trpc.settings.saveLlmConfig.useMutation({
    onSuccess: () => {
      // Also persist to localStorage so the UI survives a page refresh
      localStorage.setItem('llm_settings', JSON.stringify({ provider, apiKey, apiUrl, model }));
      setSaved(true);
      toast.success('LLM settings saved! Agents will now use your configured provider.');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  // Load from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem('llm_settings');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.provider) setProvider(s.provider as Provider);
        if (s.apiKey) setApiKey(s.apiKey);
        if (s.apiUrl) setApiUrl(s.apiUrl);
        if (s.model) setModel(s.model);
      } catch { /* ignore */ }
    }
  }, []);

  // Auto-fill default model when provider changes
  const handleProviderChange = (val: Provider) => {
    setProvider(val);
    setModel(PROVIDERS[val].defaultModel);
  };

  const handleSave = () => {
    if (!apiKey.trim()) { toast.error('Please enter an API key'); return; }
    if (provider === 'custom' && !apiUrl.trim()) { toast.error('Please enter the API endpoint URL'); return; }
    if (!model.trim()) { toast.error('Please enter a model name'); return; }

    saveMutation.mutate({
      provider,
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim() || undefined,
      model: model.trim(),
    });
  };

  const info = PROVIDERS[provider];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure the LLM provider used by all agents</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM Provider Configuration</CardTitle>
          <CardDescription>
            Choose your provider, enter your API key, and save. All five agents will immediately use this configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Provider */}
          <div className="space-y-2">
            <Label className="font-semibold">LLM Provider</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as Provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDERS) as Provider[]).map((key) => (
                  <SelectItem key={key} value={key}>{PROVIDERS[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{info.description}</p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label className="font-semibold">API Key</Label>
            <Input
              type="password"
              placeholder="Paste your API key here"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Get your key from{' '}
              <a
                href={info.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {info.docsLabel} <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Custom URL (only for custom provider) */}
          {provider === 'custom' && (
            <div className="space-y-2">
              <Label className="font-semibold">API Endpoint URL</Label>
              <Input
                type="url"
                placeholder="https://api.example.com/v1/chat/completions"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Must be an OpenAI-compatible endpoint</p>
            </div>
          )}

          {/* Model */}
          <div className="space-y-2">
            <Label className="font-semibold">Model Name</Label>
            <Input
              type="text"
              placeholder={info.defaultModel || 'e.g. my-model-v1'}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="font-mono text-sm"
            />
            {info.defaultModel && (
              <p className="text-sm text-muted-foreground">
                Recommended: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{info.defaultModel}</code>
              </p>
            )}
          </div>

          {/* Save */}
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2 min-w-[140px]">
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : saved ? (
                <><CheckCircle className="h-4 w-4" /> Saved!</>
              ) : (
                <><Save className="h-4 w-4" /> Save Settings</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick guide */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-800">Quick Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-1">
          <p>1. Select your LLM provider above</p>
          <p>2. Click the link to get your API key from the provider's console</p>
          <p>3. Paste the key, confirm the model name, and click <strong>Save Settings</strong></p>
          <p>4. Open any Agent chat page — responses will now come from your chosen LLM</p>
        </CardContent>
      </Card>
    </div>
  );
}
