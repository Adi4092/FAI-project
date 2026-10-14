import { loginUser, rotateRefreshToken, logoutUser, attachAuthCookies, clearAuthCookies } from '../services/authService.js';
import { generateCsrfToken, setCsrfCookie } from '../middleware/csrf.js';
import { successResponse } from '../utils/apiResponse.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';

    const { user, accessToken, refreshToken } = await loginUser(email, password, userAgent, ip);
    attachAuthCookies(res, accessToken, refreshToken);

    return successResponse(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const oldToken = req.cookies?.refreshToken;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';

    const { user, accessToken, refreshToken } = await rotateRefreshToken(oldToken, userAgent, ip);
    attachAuthCookies(res, accessToken, refreshToken);

    return successResponse(res, { message: 'Token refreshed.', user });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await logoutUser(refreshToken);
    clearAuthCookies(res);

    return successResponse(res, { message: 'Successfully logged out.' });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    return successResponse(res, { user: req.user });
  } catch (error) {
    next(error);
  }
}

export function getCsrfToken(req, res) {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  return successResponse(res, { csrfToken: token });
}
