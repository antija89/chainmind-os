import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, CheckCircle } from 'lucide-react';

export default function Settings() {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('llm_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setProvider(settings.provider || 'gemini');
        setApiKey(settings.apiKey || '');
        setApiUrl(settings.apiUrl || '');
        setModel(settings.model || '');
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // Update model when provider changes
  useEffect(() => {
    const defaultModels: Record<string, string> = {
      gemini: 'gemini-2.0-flash',
      openai: 'gpt-4',
      anthropic: 'claude-3-5-sonnet-20241022',
      custom: '',
    };
    setModel(defaultModels[provider] || '');
  }, [provider]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    if (provider === 'custom' && !apiUrl.trim()) {
      toast.error('Please enter API URL for custom provider');
      return;
    }

    if (!model.trim()) {
      toast.error('Please enter a model name');
      return;
    }

    setLoading(true);
    try {
      // Save to localStorage
      const settings = {
        provider,
        apiKey,
        apiUrl,
        model,
      };
      localStorage.setItem('llm_settings', JSON.stringify(settings));

      // Also save to backend via API
      const response = await fetch('/api/trpc/settings.saveLlmConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaved(true);
      toast.success('LLM settings saved successfully!');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const providerInfo: Record<string, { description: string; defaultModel: string; docs: string }> = {
    gemini: {
      description: 'Google Gemini API - Fast and cost-effective',
      defaultModel: 'gemini-2.0-flash',
      docs: 'https://ai.google.dev',
    },
    openai: {
      description: 'OpenAI GPT models - Powerful and reliable',
      defaultModel: 'gpt-4',
      docs: 'https://platform.openai.com',
    },
    anthropic: {
      description: 'Anthropic Claude - Advanced reasoning',
      defaultModel: 'claude-3-5-sonnet-20241022',
      docs: 'https://console.anthropic.com',
    },
    custom: {
      description: 'Custom LLM endpoint - Use any provider',
      defaultModel: 'your-model-name',
      docs: '#',
    },
  };

  const info = providerInfo[provider];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your LLM provider for agent responses</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM Provider Configuration</CardTitle>
          <CardDescription>Choose your LLM provider and enter your API credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label htmlFor="provider" className="text-base font-semibold">
              LLM Provider
            </Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">
                  <span className="flex items-center gap-2">
                    🔵 Google Gemini
                  </span>
                </SelectItem>
                <SelectItem value="openai">
                  <span className="flex items-center gap-2">
                    ⚫ OpenAI (GPT)
                  </span>
                </SelectItem>
                <SelectItem value="anthropic">
                  <span className="flex items-center gap-2">
                    🟠 Anthropic (Claude)
                  </span>
                </SelectItem>
                <SelectItem value="custom">
                  <span className="flex items-center gap-2">
                    ⚙️ Custom Endpoint
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{info?.description}</p>
          </div>

          {/* API Key */}
          <div className="space-y-3">
            <Label htmlFor="apiKey" className="text-base font-semibold">
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">
              Get your API key from{' '}
              <a href={info?.docs} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {provider === 'gemini' ? 'Google AI Studio' : provider === 'openai' ? 'OpenAI Platform' : provider === 'anthropic' ? 'Anthropic Console' : 'your provider'}
              </a>
            </p>
          </div>

          {/* Custom API URL (only for custom provider) */}
          {provider === 'custom' && (
            <div className="space-y-3">
              <Label htmlFor="apiUrl" className="text-base font-semibold">
                API Endpoint URL
              </Label>
              <Input
                id="apiUrl"
                type="url"
                placeholder="https://api.example.com/v1/chat/completions"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                The full URL to your custom LLM endpoint
              </p>
            </div>
          )}

          {/* Model Name */}
          <div className="space-y-3">
            <Label htmlFor="model" className="text-base font-semibold">
              Model Name
            </Label>
            <Input
              id="model"
              type="text"
              placeholder={info?.defaultModel}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">
              Default: <code className="bg-muted px-2 py-1 rounded text-xs">{info?.defaultModel}</code>
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4 flex gap-3">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">How to Get Started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. Choose your preferred LLM provider from the dropdown above</p>
          <p>2. Get an API key from the provider's console</p>
          <p>3. Enter your API key and select the model</p>
          <p>4. Click "Save Settings"</p>
          <p>5. Your agents will now use your configured LLM for responses</p>
        </CardContent>
      </Card>
    </div>
  );
}
