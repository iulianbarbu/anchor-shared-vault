import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { AnchorSharedVault } from '../target/types/anchor_shared_vault';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { should, expect, assert } from "chai";

describe('anchor-shared-vault', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorSharedVault as Program<AnchorSharedVault>;

  const initializerAmount = 500;
  const depositAmount = 200;
  const withdrawAmount = 100;
  const sharedVaultAccount = anchor.web3.Keypair.generate();
  const initializerStateAccount = anchor.web3.Keypair.generate();
  const initializerMainAccount = anchor.web3.Keypair.generate();
  const depositerStateAccount = anchor.web3.Keypair.generate();
  const depositerMainAccount = anchor.web3.Keypair.generate();

  const payer = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();

  let mint = null;
  let initializerTokenAccount = null;
  let depositerTokenAccount = null;
  let sharedVaultTokenAccountPDA = null;
  let sharedVaultTokenAccountBump = null;
  let sharedVaultTokenAccountAuthorityPDA = null;

  it("Initialize program state", async () => {
    // Airdropping tokens to a payer.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 10 ** 9),
      "confirmed"
    );

    // Fund Main Account
    await provider.send(
      (() => {
        const tx = new Transaction();
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: initializerMainAccount.publicKey,
            lamports: 10 ** 8,
          }),
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: depositerMainAccount.publicKey,
            lamports: 10 ** 8,
          })
        );
        return tx;
      })(),
      [payer]
    );

    mint = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    initializerTokenAccount = await mint.createAccount(initializerMainAccount.publicKey);
    await mint.mintTo(
      initializerTokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      initializerAmount * 3
    );

    depositerTokenAccount = await mint.createAccount(depositerMainAccount.publicKey);
    await mint.mintTo(
      depositerTokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      depositAmount * 2
    );

    const [_sharedVaultTokenAccountPDA, _sharedVaultTokenAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("token-seed"))],
      program.programId
    );

    sharedVaultTokenAccountPDA = _sharedVaultTokenAccountPDA;
    sharedVaultTokenAccountBump = _sharedVaultTokenAccountBump;

    const [_sharedVaultTokenAccountAuthorityPDA, _sharedVaultTOkenAccountAuthorityBump] =
     await PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("shared-vault"))],
      program.programId
    );
    sharedVaultTokenAccountAuthorityPDA = _sharedVaultTokenAccountAuthorityPDA;

    let _initializerTokenAccount = await mint.getAccountInfo(initializerTokenAccount);
    assert.ok(_initializerTokenAccount.amount.toNumber() == initializerAmount * 3);

    let _depositerTokenAccount = await mint.getAccountInfo(depositerTokenAccount);
    assert.ok(_depositerTokenAccount.amount.toNumber() == depositAmount * 2);
  });

  it("Initialize shared vault", async () => {
    await program.rpc.initialize(
      sharedVaultTokenAccountBump,
      new anchor.BN(initializerAmount),
      {
        accounts: {
          initializer: initializerMainAccount.publicKey,
          initializerState: initializerStateAccount.publicKey,
          sharedVaultTokenAccount: sharedVaultTokenAccountPDA,
          mint: mint.publicKey,
          initializerTokenAccount: initializerTokenAccount,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [
          await program.account.sharedVaultAccount.createInstruction(sharedVaultAccount),
        ],
        signers: [initializerMainAccount, initializerStateAccount, sharedVaultAccount],
      }
    );
    
    let _vault = await mint.getAccountInfo(sharedVaultTokenAccountPDA);

    let _sharedVaultAccount = await program.account.sharedVaultAccount.fetch(
      sharedVaultAccount.publicKey
    );

    assert.ok(_vault.owner.equals(sharedVaultTokenAccountAuthorityPDA));
    assert.ok(_sharedVaultAccount.balance.toNumber() == initializerAmount);
  });

  it("Deposit money", async () => {
    await program.rpc.deposit(
      new anchor.BN(depositAmount),
      {
        accounts: {
          user: depositerMainAccount.publicKey,
          userState: depositerStateAccount.publicKey,
          sharedVaultTokenAccount: sharedVaultTokenAccountPDA,
          mint: mint.publicKey,
          userTokenAccount: depositerTokenAccount,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [depositerMainAccount, depositerStateAccount],
      }
    );
    
    let _sharedVaultAccount = await program.account.sharedVaultAccount.fetch(
      sharedVaultAccount.publicKey
    );
    let _depositerUserState = await program.account.userState.fetch(
      depositerStateAccount.publicKey
    );

    assert.ok(_sharedVaultAccount.balance.toNumber() == initializerAmount + depositAmount);
    assert.ok(_depositerUserState.deposited.toNumber() == depositAmount);
    assert.ok(_depositerUserState.debt.toNumber() == 0);
  });

  it("Withdraw money", async () => {
    await program.rpc.withdraw(
      new anchor.BN(withdrawAmount),
      {
        accounts: {
          user: depositerMainAccount.publicKey,
          userState: depositerStateAccount.publicKey,
          sharedVaultTokenAccount: sharedVaultTokenAccountPDA,
          mint: mint.publicKey,
          userTokenAccount: depositerTokenAccount,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          sharedVaultTokenAccountAuthority: sharedVaultTokenAccountAuthorityPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [depositerMainAccount, depositerStateAccount],
      }
    );
    
    let _sharedVaultAccount = await program.account.sharedVaultAccount.fetch(
      sharedVaultAccount.publicKey
    );
    let _depositerUserState = await program.account.userState.fetch(
      depositerStateAccount.publicKey
    );

    assert.ok(_depositerUserState.deposited.toNumber() == depositAmount - withdrawAmount);
    assert.ok(_depositerUserState.debt.toNumber() == 0);
    assert.ok(initializerAmount + depositAmount - withdrawAmount  ==_sharedVaultAccount.balance.toNumber());
  });

  it("Non-whitelisted withdraw money", async () => {
    try {
      await program.rpc.withdraw(
        new anchor.BN(depositAmount),
        {
          accounts: {
            user: depositerMainAccount.publicKey,
            userState: depositerStateAccount.publicKey,
            sharedVaultTokenAccount: sharedVaultTokenAccountPDA,
            mint: mint.publicKey,
            userTokenAccount: depositerTokenAccount,
            sharedVaultAccount: sharedVaultAccount.publicKey,
            sharedVaultTokenAccountAuthority: sharedVaultTokenAccountAuthorityPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [depositerMainAccount, depositerStateAccount],
        }
      );
    } catch(err) {
      assert.ok(err.toString() == "Can Not Borrow");
      let _depositerUserState = await program.account.userState.fetch(
        depositerStateAccount.publicKey
      );
      let _sharedVaultAccount = await program.account.sharedVaultAccount.fetch(
        sharedVaultAccount.publicKey
      );
      assert.ok(initializerAmount + depositAmount - withdrawAmount  ==_sharedVaultAccount.balance.toNumber());
      assert.ok(_depositerUserState.deposited.toNumber() == depositAmount - withdrawAmount);
      assert.ok(_depositerUserState.debt.toNumber() == 0);
    }  
  });

  it("Whitelisted withdraw money", async () => {
    await program.rpc.withdraw(
      new anchor.BN(initializerAmount + 1),
      {
        accounts: {
          user: initializerMainAccount.publicKey,
          userState: initializerStateAccount.publicKey,
          sharedVaultTokenAccount: sharedVaultTokenAccountPDA,
          mint: mint.publicKey,
          userTokenAccount: initializerTokenAccount,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          sharedVaultTokenAccountAuthority: sharedVaultTokenAccountAuthorityPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [initializerMainAccount, initializerStateAccount],
      }
    );
    
    let _sharedVaultAccount = await program.account.sharedVaultAccount.fetch(
      sharedVaultAccount.publicKey
    );
    let _initializerStateAccount = await program.account.userState.fetch(
      initializerStateAccount.publicKey
    );
    assert.ok(depositAmount - withdrawAmount - 1  ==_sharedVaultAccount.balance.toNumber());
    assert.ok(_initializerStateAccount.debt.toNumber() == 1);
    assert.ok(_initializerStateAccount.deposited.toNumber() == 0);
  });

  it("Whitelisted resolve debt", async () => {
    await program.rpc.deposit(
      new anchor.BN(initializerAmount + 1),
      {
        accounts: {
          user: initializerMainAccount.publicKey,
          userState: initializerStateAccount.publicKey,
          sharedVaultTokenAccount: sharedVaultTokenAccountPDA,
          mint: mint.publicKey,
          userTokenAccount: initializerTokenAccount,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [initializerMainAccount, initializerStateAccount],
      }
    );
    
    let _sharedVaultAccount = await program.account.sharedVaultAccount.fetch(
      sharedVaultAccount.publicKey
    );
    assert.ok(initializerAmount + depositAmount - withdrawAmount  == _sharedVaultAccount.balance.toNumber());
    let _initializerUserState = await program.account.userState.fetch(
      initializerStateAccount.publicKey
    );
    assert.ok(_initializerUserState.debt.toNumber() == 0);
    assert.ok(_initializerUserState.deposited.toNumber() == initializerAmount);
  });

  it("Check whitelist/blacklist", async () => {
    await program.rpc.whitelist(
      {
        accounts: {
          initializer: initializerMainAccount.publicKey,
          user: depositerMainAccount.publicKey,
          userState: depositerStateAccount.publicKey,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [initializerMainAccount, depositerMainAccount, depositerStateAccount]
      }
    );
    
    let _depositerUserState = await program.account.userState.fetch(
      depositerStateAccount.publicKey
    );

    assert.ok(_depositerUserState.isWhitelisted);

    await program.rpc.blacklist(
      {
        accounts: {
          initializer: initializerMainAccount.publicKey,
          user: depositerMainAccount.publicKey,
          userState: depositerStateAccount.publicKey,
          sharedVaultAccount: sharedVaultAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [initializerMainAccount, depositerMainAccount, depositerStateAccount]
      }
    );
    
    _depositerUserState = await program.account.userState.fetch(
      depositerStateAccount.publicKey
    );

    assert.ok(!_depositerUserState.isWhitelisted);
  });

});
