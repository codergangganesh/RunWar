// Generate VAPID key pair using Web Crypto API
async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  // Export public key as raw bytes -> base64url
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = Buffer.from(publicKeyRaw).toString('base64url');

  // Export private key as JWK
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const privateKeyJwkStr = JSON.stringify(privateKeyJwk);

  // d field of JWK is the private key as base64url
  const privateKeyBase64 = privateKeyJwk.d;

  console.log('\n=== VAPID KEY PAIR GENERATED ===');
  console.log('\nVAPID_PUBLIC_KEY (for .env.local + InsForge secret):');
  console.log(publicKeyBase64);
  console.log('\nVAPID_PRIVATE_KEY (base64url private scalar, for InsForge secret):');
  console.log(privateKeyBase64);
  console.log('\nVAPID_PRIVATE_KEY_JWK (full JWK, for InsForge secret - preferred):');
  console.log(privateKeyJwkStr);
  console.log('\n=== END ===\n');

  return { publicKeyBase64, privateKeyBase64, privateKeyJwkStr };
}

generateVapidKeys();
