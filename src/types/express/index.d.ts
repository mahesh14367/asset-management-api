import { UserRole, IUser } from '../../modules/user/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        employeeId: string | null;
      };
      actor?: IUser; // full user doc, attached once by `authenticate` — avoids re-querying per controller
    }
  }
}

export {};