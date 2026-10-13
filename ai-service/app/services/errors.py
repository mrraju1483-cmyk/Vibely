class AIError(Exception):
    """An expected failure with an HTTP status and a stable code the Node backend understands."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
