export function isPasswordRecoveryUrl(search = window.location.search, hash = window.location.hash) {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const searchType = searchParams.get('type');
  const hashType = hashParams.get('type');

  return (
    searchParams.has('code') ||
    hashParams.has('access_token') ||
    hashParams.has('refresh_token') ||
    searchParams.has('token_hash') ||
    searchType === 'recovery' ||
    searchType === 'magiclink' ||
    hashType === 'recovery' ||
    hashType === 'magiclink'
  );
}

export function recoveryRedirectPath(search = window.location.search, hash = window.location.hash) {
  return `/reset-password${search}${hash}`;
}
