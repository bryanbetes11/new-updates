export function isPasswordRecoveryUrl(search = window.location.search, hash = window.location.hash) {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const searchType = searchParams.get('type');
  const hashType = hashParams.get('type');
  const hasRecoveryToken = searchParams.has('code') || searchParams.has('token_hash');
  const hasHashRecoveryToken = hashParams.has('access_token') || hashParams.has('refresh_token') || hashParams.has('token_hash');

  return (
    ((searchType === 'recovery' || searchType === 'magiclink') && hasRecoveryToken) ||
    ((hashType === 'recovery' || hashType === 'magiclink') && hasHashRecoveryToken)
  );
}

export function recoveryRedirectPath(search = window.location.search, hash = window.location.hash) {
  return `/reset-password${search}${hash}`;
}
