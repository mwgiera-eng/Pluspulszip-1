import express from 'express';

declare global {
  namespace Express {
    interface User {
      claims?: Record<string, any>;
      [key: string]: any;
    }

    interface Request {
      user?: User;
      isAuthenticated?: () => boolean;
    }
  }
}

export {};
