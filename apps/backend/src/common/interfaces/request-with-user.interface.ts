import type { Request } from 'express'

export type RequestWithUser = Request & {
  user: { id: string; [k: string]: any }
}
