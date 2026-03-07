import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import type { UserRole } from '~~/app/types'

export interface TokenPayload extends JWTPayload {
  sub: string
  role: UserRole
  email: string
}

const JWT_EXPIRATION = '8h'

function getSecret(): Uint8Array {
  const config = useRuntimeConfig()
  return new TextEncoder().encode(config.jwtSecret)
}

export async function signToken(payload: {
  userId: string
  role: UserRole
  email: string
}): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as TokenPayload
}
