# BidForge - Demo Login Credentials

All demo accounts use pre-seeded data. Run `npm run seed` from the `server/` directory to create these accounts.

---

## Regular Users

| # | Username | Email | Password | Role |
|---|----------|-------|----------|------|
| 1 | john_collector | john@example.com | Password123! | user |
| 2 | sarah_antiques | sarah@example.com | Password123! | user |
| 3 | mike_bidder | mike@example.com | Password123! | user |
| 4 | emma_vintage | emma@example.com | Password123! | user |

## Admin User

| # | Username | Email | Password | Role |
|---|----------|-------|----------|------|
| 5 | admin_user | admin@bidforge.com | AdminPass123! | admin |

---

## Quick Copy-Paste

### User Login
```
Email:    john@example.com
Password: Password123!
```

### Admin Login
```
Email:    admin@bidforge.com
Password: AdminPass123!
```

---

## Notes

- All regular users have the same password: `Password123!`
- The admin account has a different password: `AdminPass123!`
- To reset all data, run: `npm run seed:fresh` from the `server/` directory
- Passwords are hashed with bcrypt before storing in MongoDB
