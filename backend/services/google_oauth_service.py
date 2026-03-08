"""Google OAuth2 + Calendar API integration."""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"

# GSI code flow with popup: token exchange must use redirect_uri "postmessage" (not your app URL)
GSI_TOKEN_REDIRECT_URI = "postmessage"


async def exchange_auth_code(code: str) -> dict:
    """Exchange an authorization code from GSI for access/refresh tokens."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise ValueError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GSI_TOKEN_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code >= 400:
            try:
                err = resp.json()
                msg = err.get("error_description") or err.get("error") or resp.text
            except Exception:
                msg = resp.text
            logger.error("Google token exchange error %s: %s", resp.status_code, msg)
            raise ValueError(f"Google token exchange failed: {msg}")
        return resp.json()


async def get_google_user_info(access_token: str) -> dict:
    """Fetch user profile from Google using the access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(USERINFO_ENDPOINT, headers={
            "Authorization": f"Bearer {access_token}",
        })
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired Google access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_ENDPOINT, data={
            "refresh_token": refresh_token,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
        resp.raise_for_status()
        return resp.json()


def _build_credentials(user) -> Optional[Credentials]:
    """Build google.oauth2.credentials.Credentials from stored user tokens."""
    if not user.google_access_token:
        return None
    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri=TOKEN_ENDPOINT,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )
    return creds


async def get_calendar_service(user):
    """Build a Google Calendar API service client. Auto-refreshes token if expired."""
    creds = _build_credentials(user)
    if not creds:
        return None

    # Check if token is expired and refresh
    if user.google_token_expiry and datetime.utcnow() >= user.google_token_expiry:
        if user.google_refresh_token:
            try:
                token_data = await refresh_access_token(user.google_refresh_token)
                user.google_access_token = token_data["access_token"]
                user.google_token_expiry = datetime.utcnow() + timedelta(
                    seconds=token_data.get("expires_in", 3600)
                )
                await user.save()
                creds = _build_credentials(user)
            except Exception as e:
                logger.error("Failed to refresh Google token: %s", e)
                return None

    return build("calendar", "v3", credentials=creds)
