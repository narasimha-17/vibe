"""Minimal OAuth2 authorization-code helpers for Google and GitHub.

Implemented with raw httpx calls rather than a full framework integration
so the "not configured" fallback is easy to reason about: every function
here simply isn't called unless the relevant client id/secret are set
(checked by the router via `settings.google_configured` / `github_configured`).

NOTE: for brevity this scaffold skips OAuth `state` CSRF verification.
Before shipping this to real users, add a signed, single-use `state`
value stored server-side (or in a short-lived cookie) and verify it on
callback.
"""

import httpx

from app.core.config import get_settings

settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails"


def google_authorize_url(redirect_uri: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    }
    query = httpx.QueryParams(params)
    return f"{GOOGLE_AUTH_URL}?{query}"


async def google_exchange_and_fetch_user(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_res.raise_for_status()
        access_token = token_res.json()["access_token"]

        user_res = await client.get(
            GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
        )
        user_res.raise_for_status()
        data = user_res.json()
        return {
            "provider_id": data["sub"],
            "email": data.get("email", ""),
            "name": data.get("name", ""),
            "avatar_url": data.get("picture"),
        }


def github_authorize_url(redirect_uri: str, scope: str = "read:user user:email") -> str:
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
    }
    query = httpx.QueryParams(params)
    return f"{GITHUB_AUTH_URL}?{query}"


async def github_exchange_code(code: str, redirect_uri: str) -> str:
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        token_res.raise_for_status()
        payload = token_res.json()
        if "access_token" not in payload:
            raise ValueError(f"GitHub token exchange failed: {payload}")
        return payload["access_token"]


async def github_fetch_user(access_token: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    async with httpx.AsyncClient() as client:
        user_res = await client.get(GITHUB_USER_URL, headers=headers)
        user_res.raise_for_status()
        data = user_res.json()
        email = data.get("email")
        if not email:
            emails_res = await client.get(GITHUB_USER_EMAILS_URL, headers=headers)
            if emails_res.status_code == 200:
                emails = emails_res.json()
                primary = next((e for e in emails if e.get("primary")), emails[0] if emails else None)
                email = primary["email"] if primary else f"{data['login']}@users.noreply.github.com"
        return {
            "provider_id": str(data["id"]),
            "email": email or f"{data['login']}@users.noreply.github.com",
            "name": data.get("name") or data.get("login", ""),
            "avatar_url": data.get("avatar_url"),
            "username": data.get("login"),
        }
