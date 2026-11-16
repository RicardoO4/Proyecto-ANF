// Mirrors Spring's GlobalExceptionHandler + custom exceptions.
// Error body shape: ErrorResponse { timestamp, status, error, message, path }

export class BadRequestException extends Error {
  status = 400
  errorLabel = 'Bad Request'
}

export class NotFoundException extends Error {
  status = 404
  errorLabel = 'Not Found'
}

export class BusinessRuleException extends Error {
  status = 409
  errorLabel = 'Conflict'
}

export class ValidationException extends Error {
  status = 400
  errorLabel = 'Validation Error'
  detalles: string[]

  constructor(message: string, detalles: string[] = []) {
    super(message)
    this.detalles = detalles
  }
}

export class UnauthorizedException extends Error {
  status = 401
  errorLabel = 'Unauthorized'
}

export class ForbiddenException extends Error {
  status = 403
  errorLabel = 'Forbidden'
}

export class InternalException extends Error {
  status = 500
  errorLabel = 'Internal Server Error'
}

const GENERIC_500_MESSAGE =
  'Ocurrió un error inesperado. Por favor, contacte al administrador.'

export function errorResponse(req: Request, err: unknown): Response {
  const url = new URL(req.url)
  const path = url.pathname

  if (err instanceof BadRequestException || err instanceof NotFoundException ||
      err instanceof BusinessRuleException || err instanceof ValidationException ||
      err instanceof UnauthorizedException || err instanceof ForbiddenException) {
    return Response.json(
      {
        timestamp: new Date().toISOString(),
        status: err.status,
        error: err.errorLabel,
        message: err.message,
        path,
        ...(err instanceof ValidationException && err.detalles.length > 0
          ? { detalles: err.detalles }
          : {}),
      },
      { status: err.status },
    )
  }

  // Any unexpected failure → 500 with the generic message (as in Java),
  // but log the real cause server-side.
  console.error(`[API] ${path}`, err)
  return Response.json(
    {
      timestamp: new Date().toISOString(),
      status: 500,
      error: 'Internal Server Error',
      message: GENERIC_500_MESSAGE,
      path,
    },
    { status: 500 },
  )
}

/**
 * Wraps a /api/v1 handler: checks the session and module permission
 * (lib/permisos.ts), then turns any thrown error into the ErrorResponse.
 */
export async function handle(
  req: Request,
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    // dynamic import: permisos.ts imports this module's exception classes
    const { autorizar } = await import('@/lib/permisos')
    await autorizar(req)
    return await fn()
  } catch (err) {
    return errorResponse(req, err)
  }
}
