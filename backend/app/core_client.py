"""HTTP client for Core API communication."""

from typing import Any

import httpx
from fastapi import HTTPException, Request


class CoreAPIError(Exception):
    """Base exception for Core API errors."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class CoreAPIClient:
    """Async HTTP client for Core API."""

    def __init__(self, base_url: str, timeout: float = 60.0):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def register(self, email: str, password: str) -> dict[str, Any]:
        """Register a new user in Core API.

        Args:
            email: User email address
            password: User password (min 8 chars)

        Returns:
            User response: {id, email, is_active, role, created_at}

        Raises:
            CoreAPIError: If registration fails
        """
        try:
            response = await self.client.post(
                "/api/v1/auth/register",
                json={"email": email, "password": password},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise CoreAPIError(
                status_code=e.response.status_code,
                detail=e.response.text,
            ) from e
        except httpx.RequestError as e:
            raise CoreAPIError(
                status_code=503,
                detail=f"Core API connection error: {e}",
            ) from e

    async def login(self, email: str, password: str) -> dict[str, Any]:
        """Login to Core API.

        Args:
            email: User email address
            password: User password

        Returns:
            Token response: {access_token, refresh_token, token_type, user}

        Raises:
            CoreAPIError: If login fails
        """
        try:
            response = await self.client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": password},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise CoreAPIError(
                status_code=e.response.status_code,
                detail=e.response.text,
            ) from e
        except httpx.RequestError as e:
            raise CoreAPIError(
                status_code=503,
                detail=f"Core API connection error: {e}",
            ) from e

    async def refresh(self, refresh_token: str) -> dict[str, Any]:
        """Refresh access token using refresh token.

        Args:
            refresh_token: Valid refresh token from login

        Returns:
            Token response: {access_token, refresh_token, token_type, user}

        Raises:
            CoreAPIError: If refresh fails
        """
        try:
            response = await self.client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": refresh_token},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise CoreAPIError(
                status_code=e.response.status_code,
                detail=e.response.text,
            ) from e
        except httpx.RequestError as e:
            raise CoreAPIError(
                status_code=503,
                detail=f"Core API connection error: {e}",
            ) from e

    async def request(
        self,
        method: str,
        path: str,
        access_token: str,
        **kwargs: Any,
    ) -> httpx.Response:
        """Make an authenticated request to Core API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            path: API path (e.g., /api/v1/entries)
            access_token: Valid access token for authentication
            **kwargs: Additional arguments passed to httpx.request

        Returns:
            httpx.Response object

        Raises:
            CoreAPIError: If request fails
        """
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {access_token}"

        try:
            response = await self.client.request(
                method,
                path,
                headers=headers,
                **kwargs,
            )
            return response
        except httpx.RequestError as e:
            raise CoreAPIError(
                status_code=503,
                detail=f"Core API connection error: {e}",
            ) from e

    async def close(self) -> None:
        """Close the HTTP client."""
        await self.client.aclose()


def get_core_api(request: Request) -> CoreAPIClient:
    """FastAPI dependency to get CoreAPIClient instance.

    The client is created at app startup and stored in app.state.

    Args:
        request: FastAPI request object

    Returns:
        CoreAPIClient instance

    Raises:
        HTTPException: If client not initialized
    """
    core_api = getattr(request.app.state, "core_api", None)
    if core_api is None:
        raise HTTPException(
            status_code=500,
            detail="Core API client not initialized",
        )
    return core_api
