import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().email('Please enter a valid email address.').trim().toLowerCase(),
    password: z.string().min(1, 'Password is required.')
  })
};
