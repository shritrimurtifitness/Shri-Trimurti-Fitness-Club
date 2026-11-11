const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const phoneId = process.env.PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_TOKEN;

if (!phoneId || !token) {
  console.error('Error: PHONE_NUMBER_ID and WHATSAPP_TOKEN must be set in backend/.env');
  process.exit(1);
}

const logoPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../../frontend/src/assets/logo.png');

if (!fs.existsSync(logoPath)) {
  console.error('Error: Image file does not exist at:', logoPath);
  process.exit(1);
}

const fileBuffer = fs.readFileSync(logoPath);
const fileLength = fileBuffer.length;

console.log(`Starting WhatsApp Profile Picture update with: ${logoPath} (${fileLength} bytes)...`);

// 1. Create Resumable Upload Session
const sessionUrl = `https://graph.facebook.com/v21.0/app/uploads?file_length=${fileLength}&file_type=image/png`;
const sessionReq = https.request(sessionUrl, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.id) {
        console.error('Failed to create upload session:', data);
        process.exit(1);
      }
      console.log('Upload session created:', parsed.id);
      uploadBytes(parsed.id);
    } catch (e) {
      console.error('Parse error:', e.message, data);
      process.exit(1);
    }
  });
});
sessionReq.on('error', err => {
  console.error('Session request error:', err);
  process.exit(1);
});
sessionReq.end();

// 2. Upload Binary Image Bytes
function uploadBytes(sessionId) {
  const uploadUrl = `https://graph.facebook.com/v21.0/${sessionId}`;
  const uploadReq = https.request(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${token}`,
      'file_offset': 0,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileLength
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.h) {
          console.error('Failed to upload image bytes:', data);
          process.exit(1);
        }
        console.log('Image uploaded successfully! Handle:', parsed.h);
        updateProfile(parsed.h);
      } catch (e) {
        console.error('Upload parse error:', e.message, data);
        process.exit(1);
      }
    });
  });
  uploadReq.on('error', err => {
    console.error('Upload bytes error:', err);
    process.exit(1);
  });
  uploadReq.write(fileBuffer);
  uploadReq.end();
}

// 3. Update WhatsApp Business Profile
function updateProfile(handle) {
  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    profile_picture_handle: handle,
    about: 'Shri Trimurti Fitness Club — Official WhatsApp',
    description: 'Book Cricket & Football Turf at Shri Trimurti Fitness Club in Koparde. Floodlit grounds, instant slot booking, 0% platform fee.',
    address: 'Kudire Factory, Sangrul Fata, Koparde, Maharashtra 416205',
    email: 'shritrimurtifitness@gmail.com',
    websites: ['https://shritrimurtifitnessclub.in']
  });

  const profileUrl = `https://graph.facebook.com/v21.0/${phoneId}/whatsapp_business_profile`;
  const profileReq = https.request(profileUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Profile update response:', data);
      console.log('✅ WhatsApp Business Display Picture (DP) and Profile updated successfully!');
      process.exit(0);
    });
  });
  profileReq.on('error', err => {
    console.error('Profile update error:', err);
    process.exit(1);
  });
  profileReq.write(payload);
  profileReq.end();
}
