/**
 * Receipt OCR Service for SHRI TRIMURTI FITNESS CLUB WhatsApp Bot
 * Powered by Google Gemini Flash Vision API (gemini-3.5-flash / gemini-3.5-flash-lite).
 *
 * Automatically detects and extracts:
 * - UPI Reference Number / UTR / Transaction ID (12+ digits)
 * - Last 4 digits of UPI Ref ID
 * - Payment Amount (₹)
 * - Payment App Name (Google Pay, PhonePe, Paytm, BHIM, CRED, etc.)
 * - Payment Status (Success, Completed, etc.)
 *
 * Privacy / Security:
 * - As requested by club admin, screenshots are NOT forwarded to anyone.
 * - Only the verified UTR/Ref digits are extracted in-memory to automate booking confirmation.
 */

/**
 * Downloads WhatsApp media binary from Meta Cloud API using mediaId.
 * @param {string} mediaId - WhatsApp media identifier from incoming webhook
 * @returns {Promise<{ buffer: Buffer, base64Data: string, mimeType: string }>}
 */
async function downloadMetaMedia(mediaId) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    throw new Error('WHATSAPP_TOKEN is not configured');
  }

  // Step 1: Query Graph API to get the media download URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Failed to fetch media metadata from Meta (Status ${metaRes.status}): ${errText}`);
  }

  const metaData = await metaRes.json();
  const downloadUrl = metaData.url;
  const mimeType = metaData.mime_type || 'image/jpeg';

  if (!downloadUrl) {
    throw new Error('Meta API returned no download URL for mediaId: ' + mediaId);
  }

  // Step 2: Download the binary file from Meta media CDN
  const fileRes = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!fileRes.ok) {
    const errText = await fileRes.text();
    throw new Error(`Failed to download media binary from Meta (Status ${fileRes.status}): ${errText}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Data = buffer.toString('base64');

  return {
    buffer,
    base64Data,
    mimeType,
  };
}

/**
 * Analyzes payment receipt screenshot using Gemini Vision API to extract UPI details.
 * @param {Object} params
 * @param {string} [params.base64Data] - Base64 encoded image string
 * @param {Buffer} [params.buffer] - Image buffer
 * @param {string} [params.mimeType='image/jpeg'] - MIME type of the image
 * @returns {Promise<{ success: boolean, isPaymentReceipt: boolean, utr: string|null, last4: string|null, amount: number|null, app: string, status: string, error?: string }>}
 */
async function extractUpiRefFromReceipt({ base64Data, buffer, mimeType = 'image/jpeg' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[RECEIPT OCR] GEMINI_API_KEY is missing from environment');
    return {
      success: false,
      isPaymentReceipt: false,
      utr: null,
      last4: null,
      error: 'GEMINI_API_KEY not configured',
    };
  }

  const imageBase64 = base64Data || (buffer ? buffer.toString('base64') : null);
  if (!imageBase64) {
    return {
      success: false,
      isPaymentReceipt: false,
      utr: null,
      last4: null,
      error: 'No image data provided',
    };
  }

  const prompt = `You are an expert payment verification OCR AI for Indian UPI payment apps (Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, CRED, Airtel Payments Bank, and Indian mobile banking apps).
Analyze this payment receipt or screenshot carefully.

Your task:
1. Determine if this image is a payment confirmation receipt, success screen, or payment history entry.
2. Locate the UPI Reference ID / UTR / UPI Transaction ID / Ref No / Google Transaction ID / Order ID:
   - In India, UPI Reference Numbers (UTR) are standard 12 numeric digits (e.g., 432187654321, 271227122715).
   - Some banking apps might show a 12-to-18 digit transaction reference.
3. Extract the last 4 digits of that UTR / UPI Reference ID.
4. Extract the payment amount (in ₹) paid.
5. Identify the payment app or provider.
6. Identify the payment status (e.g. Success, Paid, Completed, Pending, Failed).

Return ONLY a raw JSON object with NO markdown formatting, NO backticks (\`\`\`), and NO explanation:
{
  "isPaymentReceipt": true,
  "utr": "271227122715",
  "last4": "2715",
  "amount": 700,
  "app": "Google Pay",
  "status": "Success"
}

If this image is NOT a payment receipt, or if no UPI/transaction reference is identifiable, return:
{
  "isPaymentReceipt": false,
  "utr": null,
  "last4": null,
  "amount": null,
  "app": "Unknown",
  "status": "Unknown"
}`;

  const candidateModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType || 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1, // Minimal temperature for precise OCR extraction
              maxOutputTokens: 1500, // Enough room for thinking + full structured JSON
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[RECEIPT OCR] ${modelName} returned status ${response.status}:`, errText);
        lastError = `Status ${response.status}: ${errText}`;
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!rawText) {
        console.warn(`[RECEIPT OCR] Empty response from ${modelName}`);
        continue;
      }

      // Clean JSON string (remove possible markdown ```json ... ``` blocks)
      const cleanJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (jsonErr) {
        // Fallback: search for JSON object inside response
        const match = cleanJson.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw jsonErr;
        }
      }

      // Normalize UTR and last4
      let utr = parsed.utr ? String(parsed.utr).trim() : null;
      let last4 = parsed.last4 ? String(parsed.last4).trim() : null;

      // Extract last 4 numeric digits if last4 is missing but utr has at least 4 digits
      if (!last4 && utr) {
        const digitsOnly = utr.replace(/\D/g, '');
        if (digitsOnly.length >= 4) {
          last4 = digitsOnly.slice(-4);
        }
      } else if (last4) {
        // Ensure last4 is sanitized to numeric digits
        const digitsOnly = last4.replace(/\D/g, '');
        if (digitsOnly.length >= 4) {
          last4 = digitsOnly.slice(-4);
        }
      }

      return {
        success: true,
        isPaymentReceipt: Boolean(parsed.isPaymentReceipt),
        utr: utr || null,
        last4: last4 || null,
        amount: typeof parsed.amount === 'number' ? parsed.amount : (parsed.amount ? parseFloat(parsed.amount) : null),
        app: parsed.app || 'Unknown',
        status: parsed.status || 'Success',
        raw: parsed,
      };
    } catch (err) {
      console.warn(`[RECEIPT OCR] Error with model ${modelName}:`, err.message);
      lastError = err.message;
    }
  }

  return {
    success: false,
    isPaymentReceipt: false,
    utr: null,
    last4: null,
    error: lastError || 'All Vision OCR models failed',
  };
}

/**
 * Downloads image from Meta Cloud API and runs OCR analysis.
 * @param {Object} params
 * @param {string} [params.mediaId] - Meta WhatsApp media ID
 * @param {string} [params.mimeType] - MIME type
 * @param {string} [params.base64Data] - Direct base64 data (if already downloaded)
 * @param {Buffer} [params.buffer] - Direct binary buffer (if already downloaded)
 * @returns {Promise<{ success: boolean, isPaymentReceipt: boolean, utr: string|null, last4: string|null, amount: number|null, app: string, status: string, error?: string }>}
 */
async function processReceiptImage({ mediaId, mimeType, base64Data, buffer }) {
  try {
    let resolvedBase64 = base64Data;
    let resolvedMime = mimeType || 'image/jpeg';
    let resolvedBuffer = buffer;

    if (mediaId && !resolvedBase64 && !resolvedBuffer) {
      console.log(`[RECEIPT OCR] Downloading mediaId ${mediaId} from Meta WhatsApp Cloud API...`);
      const downloaded = await downloadMetaMedia(mediaId);
      resolvedBase64 = downloaded.base64Data;
      resolvedMime = downloaded.mimeType || resolvedMime;
      resolvedBuffer = downloaded.buffer;
    }

    const result = await extractUpiRefFromReceipt({
      base64Data: resolvedBase64,
      buffer: resolvedBuffer,
      mimeType: resolvedMime,
    });

    console.log('[RECEIPT OCR RESULT]', {
      success: result.success,
      isPaymentReceipt: result.isPaymentReceipt,
      utr: result.utr,
      last4: result.last4,
      amount: result.amount,
      app: result.app,
    });

    return result;
  } catch (err) {
    console.error('[RECEIPT OCR PROCESS EXCEPTION]', err.message);
    return {
      success: false,
      isPaymentReceipt: false,
      utr: null,
      last4: null,
      error: err.message,
    };
  }
}

module.exports = {
  downloadMetaMedia,
  extractUpiRefFromReceipt,
  processReceiptImage,
};
