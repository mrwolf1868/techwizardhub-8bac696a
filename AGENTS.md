# Architecture rules
- Reuse the uploaded frontend's layout and asset pointers while keeping this project's managed client, authentication, wallet, and match APIs; the archive uses a different backend schema.
- Share game and service catalog cards between Home and their dedicated pages to keep layout and navigation consistent.
- Admin reporting reads live application records under the existing admin role policies; never manufacture balances, matches, or elevated roles on the client.
- Keep match charging, settlement, withdrawal requests, and admin profit withdrawals in protected database functions; clients must never change financial balances or ledgers directly.
- Store match mode, friend codes, and targeted opponents on the match record, while online presence uses one shared Realtime room.