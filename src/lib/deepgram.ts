const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen';

interface DeepgramResponse {
  results: {
    channels: {
      alternatives: {
        transcript: string;
      }[];
    }[];
  };
}

export async function transcribeWithDeepgram(
  apiKey: string,
  audioBlob: Blob,
): Promise<string> {
  const mimeType = (audioBlob.type.split(';')[0]) || 'audio/webm';

  const params = new URLSearchParams({
    language:     'es',
    model:        'nova-2',
    smart_format: 'true',
    punctuate:    'true',
  });

  const response = await fetch(`${DEEPGRAM_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type':  mimeType,
    },
    body: audioBlob,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[Deepgram] error', response.status, body);
    throw new Error(`Deepgram ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json() as DeepgramResponse;
  return data.results.channels[0]?.alternatives[0]?.transcript ?? '';
}
