# Shared vault

Solana smart contract that represents a shared vault, acting as a liquidity pool for multiple users.

## Features/Design

For a high-level description of the features covered by the smart project, please take a look
at the following diagram: **TODO**.



IDL for the communication with the smart contract can be found under `target/idl/anchor-shared-vault.json`.
The IDL is generated after building the project.

## Implementation details



## Running/testing the project.

The smart contract was developed by using [Anchor](https://github.com/project-serum/anchor). Follow
these [docs](https://project-serum.github.io/anchor/getting-started/introduction.html) for to get
started with Anchor. *To build the project*, simply run `anchor build`.

*To test it*, start a solana test validator with `solana-test-validator --reset`, deploy the build
with `anchor deploy` and then run `anchor test`.

```
anchor-shared-vault
    ✔ Initialize program state (2930ms)
    ✔ Initialize shared vault (393ms)
    ✔ Deposit money (426ms)
    ✔ Withdraw money (415ms)
Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1771
    Program 3eC59jD55nX6HvYj6tE7ycbmj8ctBiGuCjLBvK6oFNz9 invoke [1]
    Program log: Instruction: Withdraw
    Program log: Custom program error: 0x1771
    Program 3eC59jD55nX6HvYj6tE7ycbmj8ctBiGuCjLBvK6oFNz9 consumed 21895 of 200000 compute units
    Program 3eC59jD55nX6HvYj6tE7ycbmj8ctBiGuCjLBvK6oFNz9 failed: custom program error: 0x1771
    ✔ Non-whitelisted withdraw money (76ms) // This test is expected to fail and the error is piped to stdout.
    ✔ Whitelisted withdraw money (344ms)
    ✔ Whitelisted resolve debt (402ms)
    ✔ Check whitelist/blacklist (833ms)
```