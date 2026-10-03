# Price basis (frozen)

Implementation: `src/lib/prices.mjs`, market engine, position display. Context: [ARCHITECTURE.md](ARCHITECTURE.md#point-in-time-rules).

| Calculation | Series |
|-------------|--------|
| SMA20 / SMA50 | Research adjusted close (split/bonus) |
| 20-session return / RS vs Nifty | Research adjusted close vs Nifty 50 **price index** |
| Volatility | Returns of research adjusted close |
| Drawdown | Research adjusted close |
| Liquidity | Raw contemporaneous INR traded value |
| Position P&L | Raw last session close vs entry — **UNAVAILABLE** if supported split/bonus after entry |

Research series expresses history in the **as_of session price basis**, using only actions with `available_at <= as_of` and `ex_date <= as_of session date` inside the 60-session reconstruction window.

Dividends are calendar evidence only (consistent with Nifty price index, not TRI).
