/**
 * Bank SMS Parser for SHRI TRIMURTI FITNESS CLUB
 * Fast Regex-First with Google Gemini 3.5 Flash Fallback
 *
 * Extracts:
 * - isCredit (boolean) - Strictly rejects debits/withdrawals
 * - amount (number in INR)
 * - utr (12-digit UPI reference ID)
 * - last4 (last 4 digits of UTR)
 * - bank (bank provider name)
 */

/**
 * Checks whether an SMS is a debit, withdrawal, or expense message.
 * @param {string} text
 * @returns {boolean}
 */
function isDebitOrExpense(text) {
  const lower = (text || '').toLowerCase();
  const debitKeywords = [
    'debited',
    'debit',
    'withdrawn',
    'spent',
    'sent rs',
    'transferred to',
    'paid to',
    'purchase of',
    'avl bal',
    'otp for',
    'declined',
    'failed',
  ];
  return debitKeywords.some((kw) => lower.includes(kw));
}

/**
 * High-speed regex parser for standard Indian Bank UPI Credit SMS messages.
 * Supports SBI, HDFC, Axis, ICICI, Bank of Maharashtra, Canara, PNB, Paytm Bank, Kotak, etc.
 * @param {string} smsText
 * @param {string} [sender]
 * @returns {{ isCredit: boolean, amount: number|null, utr: string|null, last4: string|null, bank: string|null }|null}
 */
function parseBankSmsWithRegex(smsText, sender = '') {
  if (!smsText || typeof smsText !== 'string') return null;

  const text = smsText.trim();
  const lower = text.toLowerCase();

  // 1. Must be a credit alert and NOT a debit
  if (isDebitOrExpense(lower)) {
    return { isCredit: false, amount: null, utr: null, last4: null, bank: null };
  }

  const hasCreditWord =
    lower.includes('credit') ||
    lower.includes('deposited') ||
    lower.includes('received') ||
    lower.includes('inward') ||
    lower.includes('cr to');

  if (!hasCreditWord) {
    return null; // Not identifiable as credit via regex
  }

  // 2. Extract Amount (handles Rs. 700, Rs 700.00, INR 700, credited by Rs 700, etc.)
  let amount = null;
  const amountPatterns = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:credited\s*(?:with|by)?\s*(?:rs\.?|inr|₹)?)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:deposited\s*(?:with|by)?\s*(?:rs\.?|inr|₹)?)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:received\s*(?:rs\.?|inr|₹)?)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleanNum = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(cleanNum) && cleanNum > 0) {
        amount = cleanNum;
        break;
      }
    }
  }

  // 3. Extract 12-Digit UTR / UPI Reference Number
  let utr = null;
  const utrPatterns = [
    // Standard UPI ref / txn id: "UPI/432187652715", "UPI ref 432187652715", "UPI-432187652715"
    /(?:upi(?:\/|\s*ref(?:\s*no|\s*id)?|\s*txn(?:\s*id)?|\s*trans(?:\s*id)?|\s*vpa)?[:\s\/-]*)(\d{12})\b/i,
    // "Ref: 432187652715", "Ref No: 432187652715"
    /(?:ref(?:\s*no|\s*id)?[:\s\/-]*)(\d{12})\b/i,
    // Preceded anywhere by UPI followed by 12 digits
    /(?:upi)[^\d]{1,25}(\d{12})\b/i,
    // Any standalone 12-digit number when preceded by credit
    /\b(\d{12})\b/,
  ];

  for (const pattern of utrPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      utr = match[1];
      break;
    }
  }

  if (amount && utr && utr.length === 12) {
    // Identify bank
    let bank = 'Bank';
    const senderUpper = (sender || '').toUpperCase();
    const textUpper = text.toUpperCase();

    if (senderUpper.includes('SBI') || textUpper.includes('SBI') || textUpper.includes('STATE BANK')) bank = 'SBI';
    else if (senderUpper.includes('HDFC') || textUpper.includes('HDFC')) bank = 'HDFC';
    else if (senderUpper.includes('AXIS') || textUpper.includes('AXIS')) bank = 'Axis Bank';
    else if (senderUpper.includes('ICICI') || textUpper.includes('ICICI')) bank = 'ICICI';
    else if (senderUpper.includes('MAHA') || textUpper.includes('MAHABK') || textUpper.includes('BANK OF MAHARASHTRA')) bank = 'Bank of Maharashtra';
    else if (senderUpper.includes('CANARA') || textUpper.includes('CANARA')) bank = 'Canara Bank';
    else if (senderUpper.includes('KOTAK') || textUpper.includes('KOTAK')) bank = 'Kotak';
    else if (senderUpper.includes('PAYTM') || textUpper.includes('PAYTM')) bank = 'Paytm Payments Bank';

    return {
      isCredit: true,
      amount,
      utr,
      last4: utr.slice(-4),
      bank,
    };
  }

  return null;
}

/**
 * Gemini 3.5 Flash Fallback Parser for regional, complex, or unusual bank SMS formats.
 * @param {string} smsText
 * @param {string} [sender]
 * @returns {Promise<{ isCredit: boolean, amount: number|null, utr: string|null, last4: string|null, bank: string|null }>}
 */
async function parseBankSmsWithGemini(smsText, sender = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { isCredit: false, amount: null, utr: null, last4: null, bank: null };
  }

  const prompt = `You are a financial SMS parser for Indian banking and UPI alerts.
Analyze this bank SMS text carefully.
1. Determine if this SMS is a CREDIT (money received/deposited into bank account). If it is a debit, withdrawal, transfer out, or OTP, set "isCredit" to false.
2. Extract the amount received in INR as a number (e.g. 700).
3. Extract the 12-digit UPI Reference Number / UTR / Transaction ID (e.g. "432187652715").
4. Extract the last 4 digits of that UTR.
5. Identify the bank name.

Return ONLY a raw JSON object with NO markdown formatting, NO backticks:
{
  "isCredit": true,
  "amount": 700,
  "utr": "432187652715",
  "last4": "2715",
  "bank": "SBI"
}

If this is NOT a credit SMS or missing transaction details:
{
  "isCredit": false,
  "amount": null,
  "utr": null,
  "last4": null,
  "bank": null
}`;

  try {
    const candidateModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    for (const model of candidateModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { text: `Bank SMS Sender: ${sender}\nSMS Text: "${smsText}"` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) continue;

      const cleanJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
      let utr = parsed.utr ? String(parsed.utr).trim() : null;
      let last4 = parsed.last4 ? String(parsed.last4).trim() : null;

      if (!last4 && utr && utr.length >= 4) {
        last4 = utr.slice(-4);
      }

      return {
        isCredit: Boolean(parsed.isCredit),
        amount: typeof parsed.amount === 'number' ? parsed.amount : (parsed.amount ? parseFloat(parsed.amount) : null),
        utr: utr || null,
        last4: last4 || null,
        bank: parsed.bank || 'Bank',
      };
    }
  } catch (err) {
    console.warn('[BANK SMS GEMINI PARSER ERROR]', err.message);
  }

  return { isCredit: false, amount: null, utr: null, last4: null, bank: null };
}

/**
 * Main parser entry point: Tries regex first, falls back to Gemini 3.5 Flash if needed.
 * @param {string} smsText - Raw SMS content from MacroDroid
 * @param {string} [sender] - SMS Sender ID (e.g. VK-SBIINB)
 * @returns {Promise<{ success: boolean, isCredit: boolean, amount: number|null, utr: string|null, last4: string|null, bank: string|null, parser: string }>}
 */
async function parseBankSms(smsText, sender = '') {
  if (!smsText || typeof smsText !== 'string') {
    return {
      success: false,
      isCredit: false,
      amount: null,
      utr: null,
      last4: null,
      bank: null,
      parser: 'none',
    };
  }

  // 1. Try Fast Regex (1ms)
  const regexResult = parseBankSmsWithRegex(smsText, sender);
  if (regexResult) {
    if (!regexResult.isCredit) {
      return {
        success: false,
        isCredit: false,
        amount: null,
        utr: null,
        last4: null,
        bank: null,
        parser: 'regex_rejected_debit',
      };
    }

    if (regexResult.amount && regexResult.utr) {
      return {
        success: true,
        ...regexResult,
        parser: 'regex',
      };
    }
  }

  // 2. Fallback to Gemini Flash
  console.log('[BANK SMS] Regex inconclusive, falling back to Gemini Vision/Text API...');
  const aiResult = await parseBankSmsWithGemini(smsText, sender);

  return {
    success: Boolean(aiResult.isCredit && aiResult.amount && aiResult.utr),
    ...aiResult,
    parser: 'gemini',
  };
}

module.exports = {
  isDebitOrExpense,
  parseBankSmsWithRegex,
  parseBankSmsWithGemini,
  parseBankSms,
};
