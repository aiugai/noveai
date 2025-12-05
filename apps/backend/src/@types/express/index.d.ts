declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      email: string;
      roles: string[];
      permissions?: string[];
    }

    interface Request {
      user?: User;
    }
  }
}

// 防止TypeScript将其视为普通文件而不是模块
export {};
