import { Request, Response, NextFunction } from "express";

export abstract class UserHandler {
  /**
   * Optional: Logic to authenticate the request and return the user object.
   * If this is not implemented, 'user' will be undefined in route parameters.
   */
  public async authenticate(req: Request, res: Response): Promise<any | null> {
    return (req as any).user;
  }

  /**
   * Sign in logic. Usually returns a token or user info.
   */
  public abstract signin(req: Request, res: Response): Promise<any> | any;

  /**
   * Sign up logic.
   */
  public abstract signup(req: Request, res: Response): Promise<any> | any;

  /**
   * Logout logic.
   */
  public abstract logout(req: Request, res: Response): Promise<any> | any;
}
