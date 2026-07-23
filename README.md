# Net-Birr — Digital Ledger for Ethiopian Small Businesses

A full-stack mobile app that replaces the paper ledger used by Ethiopian shop owners: income/expense tracking, customer debt (ዱቤ) management with tamper-proof edit history, and Telegram-based payment reminders — built end-to-end by one developer.

> **Status:** Functional MVP (3 phases built and tested). Development paused after market research — see [Why this isn't a startup (yet)](#why-this-isnt-a-startup-yet) for the honest analysis. This repo now serves as a case study in building *and evaluating* a product for an emerging market.

---

## The Problem

Small retail businesses dominate Ethiopian commerce, yet most run on paper:

- Many owners **don't know their actual profit** — money comes in as a mix of cash, Telebirr, and bank transfers, and nothing reconciles it.
- Sales on credit (ዱቤ) are tracked in notebooks that get lost, disputed, or quietly "corrected."
- More than 76% of small Ethiopian retail business owners fail to succeed beyond 3 years (Geleta, 2013; Woldehanna et al., 2018; Woldeyohanes, 2014, as cited in Gebrehiwot, 2021).

## What I Built

**Phase 1 — Core ledger**
- Telegram-based authentication (no passwords — Telegram is the dominant platform in Ethiopia)
- Fast income/expense entry with daily view
- Free-tier usage limits

**Phase 2 — Subscription flow**
- Manual payment verification flow (Telebirr/bank transfer + screenshot upload + admin approval), modeled on how successful Ethiopian apps actually monetize in a market without app-store billing

**Phase 3 — Debt tracking (the core feature)**
- Customer credit ledger: mark any sale as "on credit," track balances per customer
- **Append-only audit log**: every edit to a debt stores old value, new value, and timestamp — nothing can be silently changed, making the digital record *more* trustworthy than paper
- Telegram reminders sent to customers about outstanding balances

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native (Expo) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Hosting | Railway |
| Auth + notifications | Telegram Bot API |

**Architecture notes**
- REST API with JWT sessions bootstrapped from Telegram login
- Audit logging implemented as append-only rows rather than in-place updates, so debt history is reconstructible and tamper-evident
- Subscription state machine: free → pending (screenshot submitted) → active → expired

## Screenshots

<!-- Add 3–5 screenshots or a short GIF here: daily view, debt book, edit history, reminder message -->

## Running It Locally

```bash
# Backend
cd backend
cp .env.example .env        # fill in your own values
pip install -r requirements.txt
uvicorn app.main:app --reload

# Mobile app
cd app
cp .env.example .env
npm install
npx expo start
```

You'll need a Telegram bot token (via @BotFather) and a local PostgreSQL instance. A seed script with fake data is included: `python scripts/seed.py`.

## Why this isn't a startup (yet)

I paused this project on purpose, after doing the market research I should arguably have done first. The honest findings:

1. **The freemium ledger model has failed at massive scale.** India's Khatabook reached 40M+ businesses and, alongside OkCredit, still never made pure ledger-tracking profitable — small shops love free tracking and rarely pay for it.
2. **Local evidence agrees.** The closest Ethiopian competitor (an award-winning, funded company) accumulated under 10K downloads in two years with a free product. Distribution to small merchants is the hard part, not the software.
3. **Automatic transaction capture — the one feature that changes the value proposition — is unreliable in Ethiopia today.** I tested SMS/notification behavior across Telebirr and CBE myself: credit alerts are inconsistent across providers and transaction types, so an "automatic" ledger would silently miss income, which is worse than manual entry.
4. **The unit economics don't close.** At a locally realistic price (~200 ETB/month) and typical free-to-paid conversion (2–5%), reaching even one developer salary requires a download volume no comparable local app has achieved.

**What I'd pursue if I return to it:** repositioning the exact same codebase upmarket — wholesalers and distributors who extend credit to dozens of retailers and carry six-figure receivables in notebooks. For them, the tamper-proof debt ledger solves an expensive problem, willingness to pay is far higher, and the customer base is reachable face-to-face instead of requiring viral distribution.

## What I Learned

- Shipping a complete product solo: mobile client, API, database, auth, payments, deployment
- Designing for a low-trust, cash-heavy market: manual payment verification, tamper-evident records, Telegram-first UX
- That validating willingness-to-pay is cheaper than building — and should come first
- Reading a market through competitor traction data instead of feature lists

## License

MIT — see [LICENSE](LICENSE).

---

*Built by Natanim Mengistu — [Telegram](https://t.me/natanimxo) · [natanimxo@gmail.com](mailto:natanimxo@gmail.com)*

## Sources

- Gebrehiwot, S. N. (2021). *Strategies for Ethiopian Small Retailers Businesses To Succeed Beyond 3 Years* (Doctoral dissertation, Walden University). https://scholarworks.waldenu.edu/dissertations/10299
- Bekele, E., & Worku, Z. (2008). Factors that affect the long-term survival of micro, small and medium enterprises in Ethiopia. *The South African Journal of Economics, 76*(3), 548–568.
