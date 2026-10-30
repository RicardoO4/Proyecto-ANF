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
}

export class UnauthorizedException extends Error {
  status = 401
  errorLabel = 'Unauthorized'
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
      err instanceof BusinessRuleException || err instanceof ValidationException) {
    return Response.json(
      {
        timestamp: new Date().toISOString(),
        status: err.status,
        error: err.errorLabel,
        message: err.message,
        path,
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
      message: err instanceof UnauthorizedException || err instanceof InternalException
        ? GENERIC_500_MESSAGE
        : GENERIC_500_MESSAGE,
      path,
    },
    { status: 500 },
  )
}

/** Wraps a handler so any thrown error becomes the proper ErrorResponse. */
export function handle(
  req: Request,
  fn: () => Promise<Response>,
): Promise<Response> {
  return fn().catch((err) => errorResponse(req, err))
}
