import unittest
from unittest.mock import patch
from app.pet_deletion import issue_confirmation, valid_confirmation


class PetDeletionTests(unittest.TestCase):
    def test_confirmation_bound_to_pet_and_current_profile(self):
        pet = {'id': 1, 'name': '团子', 'updated_at': '2026-10-13'}
        token = issue_confirmation(pet)
        self.assertTrue(valid_confirmation(pet, token))
        for change in [{'id': 2}, {'name': '牛奶'}, {'updated_at': '2026-10-14'}]:
            self.assertFalse(valid_confirmation({**pet, **change}, token))
        self.assertFalse(valid_confirmation(pet, token + 'tampered'))

    def test_expiry_and_invalid_token(self):
        pet = {'id': 1, 'name': '团子', 'updated_at': '2026-10-13'}
        with patch('app.pet_deletion.time.time', return_value=1000):
            token = issue_confirmation(pet)
        with patch('app.pet_deletion.time.time', return_value=1301):
            self.assertFalse(valid_confirmation(pet, token))
        for token in ['', 'invalid', 'no.number']:
            self.assertFalse(valid_confirmation(pet, token))
