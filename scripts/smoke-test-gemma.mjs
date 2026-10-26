#!/usr/bin/env node

/**
 * Opt-in Smoke Test Script for Gemma 4 API Integration.
 *
 * Makes one minimal, synthetic, non-sensitive test request to verify API connectivity.
 * - NEVER prints API keys or credentials.
 * - NEVER sends repository code or private context.
 * - Gracefully reports when credentials are unavailable.
 *
 * Usage:
 *   node scripts/smoke-test-gemma.mjs
 *   or:
 *   GEMMA_API_KEY=your_key node scripts/smoke-test-gemma.mjs
 */

const apiKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY || '';
const modelName = process.env.GEMMA_MODEL_NAME || 'gemma-4-26b-a4b-it';
const endpoint = (process.env.GEMMA_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models')
  .trim()
  .replace(/\/+$/, '');

console.log('--- FirstPR Gemma 4 Smoke Test ---');
console.log(`Configured Model Identifier : ${modelName}`);
console.log(`Target Base Endpoint        : ${endpoint}`);

if (!apiKey) {
  console.log('\n[STATUS: SKIPPED] No credentials detected in environment.');
  console.log('To run a live smoke test:');
  console.log('  1. Obtain a Gemini API key from Google AI Studio (https://aistudio.google.com).');
  console.log('  2. Export the variable in your shell or add it to .env.local:');
  console.log('     export GEMMA_API_KEY="your_api_key_here"');
  console.log('  3. Re-run: node scripts/smoke-test-gemma.mjs\n');
  process.exit(0);
}

// Redact API key display
const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '****';
console.log(`API Key Status              : Present (Masked: ${maskedKey})`);

const cleanEndpoint = endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`;
const cleanModel = modelName.replace(/^models\//, '');
const targetUrl = `${cleanEndpoint}/${encodeURIComponent(cleanModel)}:generateContent`;

console.log(`Computed Request URL        : ${targetUrl}`);
console.log('Sending synthetic non-sensitive probe request...\n');

const payload = {
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: 'Respond strictly with a JSON object: {"ping": "pong", "status": "ok"}',
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.1,
    responseMimeType: 'application/json',
  },
};

async function runSmokeTest() {
  const startTime = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`HTTP Status Code            : ${res.status} ${res.statusText}`);
    console.log(`Latency                     : ${elapsedMs}ms`);

    if (!res.ok) {
      let errorMessage = 'Non-OK response';
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) {
          errorMessage = errJson.error.message;
        }
      } catch {
        errorMessage = await res.text();
      }
      console.error(`\n[SMOKE TEST FAILED] API returned error: ${errorMessage}`);
      process.exit(1);
    }

    const data = await res.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      console.error('\n[SMOKE TEST FAILED] API returned 200 OK but no candidate text content was found.');
      process.exit(1);
    }

    console.log('\n[SMOKE TEST PASSED]');
    console.log(`Response length             : ${rawContent.length} characters`);
    console.log(`Usable response content     : ${rawContent.trim().slice(0, 100)}`);
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    console.error(`\n[SMOKE TEST ERROR] Request failed after ${elapsedMs}ms:`, err.message);
    process.exit(1);
  }
}

runSmokeTest();
