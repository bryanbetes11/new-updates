export function isPasswordRecoveryUrl(search = window.location.search, hash = window.location.hash) {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const searchType = searchParams.get('type');
  const hashType = hashParams.get('type');

  return (
    searchType === 'recovery' ||
    hashType === 'recovery' ||
    (searchType === 'recovery' && searchParams.has('code')) ||
    (hashType === 'recovery' && hashParams.has('access_token'))
  );
}

export function recoveryRedirectPath(search = window.location.search, hash = window.location.hash) {
  return `/reset-password${search}${hash}`;
}
