export class HttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

export const isNotFound = (error: unknown) => error instanceof HttpError && error.status === 404

/** Turn an openapi-fetch result into data or a thrown HttpError. */
export async function unwrap<T>(request: Promise<{ data?: T; response: Response }>): Promise<T> {
  const { data, response } = await request
  if (!response.ok || data === undefined) throw new HttpError(response.status)
  return data
}
