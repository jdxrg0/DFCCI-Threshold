import api from '../api';

export const getMe = () =>
  api.get('/auth/me').then(r => r.data);

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

export const googleAuth = (credential, confirmedName = null) =>
  api.post('/auth/google', { credential, confirmedName }).then(r => r.data);

export const signup = (data) =>
  api.post('/auth/signup', data).then(r => r.data);

export const verifyOtp = (email, otp) =>
  api.post('/auth/verify-otp', { email, otp }).then(r => r.data);

export const resendOtp = (email) =>
  api.post('/auth/resend-otp', { email }).then(r => r.data);

export const logout = () =>
  api.post('/auth/logout').then(r => r.data);

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email }).then(r => r.data);

export const resetPassword = (email, otp, newPassword) =>
  api.post('/auth/reset-password', { email, otp, newPassword }).then(r => r.data);

// User profile operations
export const updateName = (displayName) =>
  api.put('/users/me/update-name', { displayName }).then(r => r.data);

export const updateProfile = (formData) =>
  api.put('/users/me/update-profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const updateEmail = (newEmail) =>
  api.put('/users/me/update-email', { newEmail }).then(r => r.data);

export const verifyEmailOtp = (otp) =>
  api.post('/users/me/verify-email-otp', { otp }).then(r => r.data);

export const resendEmailOtp = () =>
  api.post('/users/me/resend-email-otp').then(r => r.data);

export const cancelEmailUpdate = () =>
  api.post('/users/me/cancel-email-update').then(r => r.data);

export const updatePassword = (currentPassword, newPassword) =>
  api.put('/users/me/update-password', { currentPassword, newPassword }).then(r => r.data);

export const removeProfilePicture = () =>
  api.delete('/users/me/remove-profile-picture').then(r => r.data);
