import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const VIRO_REVISION = '99b1d87c55ca9f43a6452144183a0b32a2bfb3c9';
const ENDPOINT = `https://api.github.com/repos/mikevocalz/viro/git/commits/${VIRO_REVISION}`;

/**
 * Verify access to the pinned private source without printing credentials,
 * response bodies, or raw network exceptions. This is not a build test.
 * The injected request function lets portable CI test every verdict offline.
 */
export async function checkViroAccess(env = process.env, request = globalThis.fetch) {
  if (env.GITHUB_REPOSITORY !== 'mikevocalz/viro-external' ||
      env.GITHUB_REF !== 'refs/heads/main' ||
      !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) {
    throw new Error('Private Viro access checks are restricted to trusted main push/manual jobs.');
  }
  const token = env.DEPENDENCY_TOKEN;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('The dependency secret is unavailable to this job; no authentication request was made.');
  }
  if (/\s/.test(token)) {
    throw new Error('The saved dependency secret contains whitespace. Store only the token value, not an env file or assignment.');
  }

  let response;
  try {
    response = await request(ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'viro-external-ci-access-check',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // Never expose a raw error: request libraries may include headers in it.
    throw new Error('Viro access request failed (network, timeout, or redirect). No credential-validity verdict is available.');
  }
  // No response payload is needed; never log it, even on errors.
  try { await response.body?.cancel(); } catch { /* Best-effort stream cleanup. */ }
  const status = response.status;
  if (status === 200) {
    return 'Pinned private Viro revision is accessible through the GitHub API (HTTP 200). Git checkout and build validation remain separate checks.';
  }
  const messages = {
    401: 'GitHub rejected the saved credential (HTTP 401). Check the existing token value, expiry, or revocation; this is not an empty-secret error.',
    403: 'GitHub refused access to the pinned Viro source (HTTP 403). Check Contents: read, token approval, applicable access policies, and rate limits.',
    404: 'GitHub did not expose the pinned Viro revision to this credential (HTTP 404). Check that the existing token includes mikevocalz/viro with Contents: read and that the pinned revision exists.',
    429: 'GitHub rate-limited the Viro access check (HTTP 429). Retry later; token validity is not established.',
  };
  throw new Error(messages[status] ?? 'GitHub returned an unexpected status for the Viro access check. No credential-validity verdict is available.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkViroAccess().then(
    message => console.log(message),
    error => { console.error(`::error::${error.message}`); process.exitCode = 1; },
  );
}
