/**
 * Webhook Validation
 *
 * Validates incoming webhooks from various sources.
 */

export async function validateWebhook(
  request: Request,
  source: string,
  secret: string
): Promise<boolean> {
  switch (source) {
    case 'sentry':
      return validateSentryWebhook(request, secret);
    case 'cloudwatch':
      // CloudWatch uses SNS subscription confirmation
      return validateCloudWatchWebhook(request);
    default:
      return validateCustomWebhook(request, secret);
  }
}

async function validateSentryWebhook(
  request: Request,
  secret: string
): Promise<boolean> {
  const signature = request.headers.get('sentry-hook-signature');
  if (!signature) return false;

  const body = await request.clone().text();
  const expected = await computeHmac(secret, body);

  return signature === expected;
}

async function validateCloudWatchWebhook(request: Request): Promise<boolean> {
  // For SNS, we verify the message signature using AWS's public key
  // In production, implement full SNS signature verification
  // For now, check for required SNS headers
  const messageType = request.headers.get('x-amz-sns-message-type');
  return messageType === 'Notification' || messageType === 'SubscriptionConfirmation';
}

async function validateCustomWebhook(
  request: Request,
  secret: string
): Promise<boolean> {
  const signature = request.headers.get('x-webhook-signature');
  if (!signature) return false;

  const body = await request.clone().text();
  const expected = await computeHmac(secret, body);

  return signature === expected;
}

async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
