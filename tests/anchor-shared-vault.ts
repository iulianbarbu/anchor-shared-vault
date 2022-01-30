import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { AnchorSharedVault } from '../target/types/anchor_shared_vault';

describe('anchor-shared-vault', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.AnchorSharedVault as Program<AnchorSharedVault>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
