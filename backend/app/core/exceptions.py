"""Domain exceptions, raised by the service layer and translated to HTTP
responses by a single global exception handler (Module 1 §4) — routers never
contain try/except for business errors."""


class DomainError(Exception):
    """Base class for all business-rule violations."""

    status_code: int = 400

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class UnauthorizedError(DomainError):
    status_code = 401


class ForbiddenError(DomainError):
    status_code = 403


class ValidationDomainError(DomainError):
    status_code = 422
