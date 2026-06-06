"""Custom application exceptions."""


class SupabaseConnectionError(Exception):
    """Raised when the Supabase client cannot be created or reach the database."""

    def __init__(self, message: str = "Failed to connect to Supabase"):
        self.message = message
        super().__init__(message)


class SupabaseQueryError(Exception):
    """Raised when a Supabase query fails."""

    def __init__(self, message: str = "Database query failed", *, table: str | None = None):
        self.message = message
        self.table = table
        super().__init__(message)


class NewsCollectionError(Exception):
    """Raised when news collection fails completely."""

    def __init__(self, message: str = "News collection failed"):
        self.message = message
        super().__init__(message)
