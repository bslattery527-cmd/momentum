/** JWT configuration constants */
export const JWT_ACCESS_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '30d';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  type: 'refresh';
  iat?: number;
  exp?: number;
}
