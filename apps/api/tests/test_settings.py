from httpx import AsyncClient


async def test_profile_update_and_me_flags(auth_client: AsyncClient):
    res = await auth_client.patch("/auth/me", json={"name": "New Name"})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "New Name"
    assert body["has_password"] is True
    assert body["github_linked"] is False


async def test_password_otp_flow(auth_client: AsyncClient):
    sent = await auth_client.post("/auth/password-otp/send")
    assert sent.status_code == 200
    body = sent.json()
    assert body["delivery"] == "console"
    assert "*" in body["email"] and body["email"].endswith("@example.com")
    code = body["dev_code"]
    assert code and len(code) == 6

    wrong_code = "000000" if code != "000000" else "111111"
    wrong = await auth_client.post("/auth/password-otp/confirm", json={"code": wrong_code, "new_password": "newpass1234"})
    assert wrong.status_code == 400
    assert "attempts left" in wrong.json()["detail"]

    ok = await auth_client.post("/auth/password-otp/confirm", json={"code": code, "new_password": "newpass1234"})
    assert ok.status_code == 204
    login = await auth_client.post("/auth/login", json={"email": "user@example.com", "password": "newpass1234"})
    assert login.status_code == 200

    reuse = await auth_client.post("/auth/password-otp/confirm", json={"code": code, "new_password": "another12345"})
    assert reuse.status_code == 400


async def test_password_otp_resend_is_rate_limited(auth_client: AsyncClient):
    assert (await auth_client.post("/auth/password-otp/send")).status_code == 200
    assert (await auth_client.post("/auth/password-otp/send")).status_code == 429


async def test_password_otp_locks_after_too_many_attempts(auth_client: AsyncClient):
    code = (await auth_client.post("/auth/password-otp/send")).json()["dev_code"]
    bad = "000000" if code != "000000" else "111111"
    for _ in range(5):
        res = await auth_client.post("/auth/password-otp/confirm", json={"code": bad, "new_password": "newpass1234"})
        assert res.status_code == 400
    locked = await auth_client.post("/auth/password-otp/confirm", json={"code": code, "new_password": "newpass1234"})
    assert locked.status_code == 429


async def test_delete_account_needs_matching_email(auth_client: AsyncClient):
    bad = await auth_client.delete("/auth/me", params={"confirm": "wrong@example.com"})
    assert bad.status_code == 400
    ok = await auth_client.delete("/auth/me", params={"confirm": "user@example.com"})
    assert ok.status_code == 204
    assert (await auth_client.get("/auth/me")).status_code == 401


async def test_github_disconnect_is_idempotent(auth_client: AsyncClient):
    assert (await auth_client.delete("/github/connect")).status_code == 204
