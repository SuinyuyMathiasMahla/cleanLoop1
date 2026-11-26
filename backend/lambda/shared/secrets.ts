import {
  GetSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

// The one place Lambda code reads secrets (ADR 0001, section 7a). Handlers call
// getSecret and never a secret store directly, so changing stores touches this file only.

const client = new SecretsManagerClient({});
const cache = new Map<string, Promise<string>>();

/**
 * Returns the secret's value, read once per cold start and cached. A missing secret
 * or an empty name gives an empty string, so optional features such as geocoding
 * switch themselves off instead of failing the request.
 */
export function getSecret(name: string | undefined): Promise<string> {
  if (!name) return Promise.resolve('');
  let value = cache.get(name);
  if (!value) {
    value = read(name);
    cache.set(name, value);
  }
  return value;
}

async function read(name: string): Promise<string> {
  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: name }));
    return result.SecretString ?? '';
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      console.warn(`Secret ${name} does not exist; the feature that needs it is off`);
      return '';
    }
    // Do not cache a transient failure; the next call tries again.
    cache.delete(name);
    throw error;
  }
}
