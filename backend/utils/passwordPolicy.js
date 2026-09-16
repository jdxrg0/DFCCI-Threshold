// A single definition of what a password must look like, so signup, the
// reset flow and the "change my password" form cannot drift out of step.
// Returns an error message, or null when the password is acceptable.
const validatePassword = (password) => {
  const value = String(password ?? '');
  if (value.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  return null;
};

module.exports = { validatePassword };