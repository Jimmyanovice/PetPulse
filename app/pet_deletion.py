"""Short-lived confirmation bound to a specific, unchanged pet profile."""
import hashlib
import hmac
import json
import secrets
import time

_SECRET = secrets.token_bytes(32)


def issue_confirmation(pet):
    expires = int(time.time()) + 300
    return f'{expires}.{signature(pet, expires)}'


def signature(pet, expires):
    payload = json.dumps([pet['id'], pet['name'], str(pet['updated_at']), expires], ensure_ascii=False)
    return hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()


def valid_confirmation(pet, token):
    try:
        expires_text, digest = token.split('.', 1)
        expires = int(expires_text)
        return time.time() < expires <= time.time() + 300 and hmac.compare_digest(digest, signature(pet, expires))
    except (ValueError, TypeError):
        return False
