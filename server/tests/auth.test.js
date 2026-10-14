import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { User } from '../src/models/User.js';

describe('Auth & Security API', () => {
  let adminUser, staffUser;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    adminUser = await User.create({
      name: 'Admin Test',
      email: 'admin@test.local',
      passwordHash: hash,
      role: 'admin',
      isActive: true
    });

    staffUser = await User.create({
      name: 'Staff Test',
      email: 'staff@test.local',
      passwordHash: hash,
      role: 'staff',
      isActive: true
    });
  });

  it('POST /api/auth/login succeeds with valid credentials and sets cookies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('admin@test.local');
    expect(res.body.data.user.passwordHash).toBeUndefined();

    // Check cookies
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);
  });

  it('POST /api/auth/login rejects invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTHENTICATION_FAILED');
  });

  it('GET /api/auth/me returns authenticated user details', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'password123' });

    const cookies = loginRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookies);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('admin@test.local');
  });

  it('CSRF double-submit token check rejects mutation when token missing', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'password123' });

    const cookies = loginRes.headers['set-cookie'];

    // Send POST request with cookies but WITHOUT X-CSRF-Token header
    const res = await request(app)
      .post('/api/medicines')
      .set('Cookie', cookies)
      .send({
        medicineCode: 'MED-TEST',
        name: 'Test Med',
        category: 'Analgesic',
        unit: 'tablet',
        reorderLevel: 50
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ERROR');
  });

  it('RBAC rejects staff from admin-only endpoints with 403 Forbidden', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@test.local', password: 'password123' });

    const cookies = loginRes.headers['set-cookie'];
    const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
    const csrfToken = csrfCookie.split(';')[0].split('=')[1];

    // Staff tries to access admin-only /api/users
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
