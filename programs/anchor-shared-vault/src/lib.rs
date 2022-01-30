use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, SetAuthority, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

declare_id!("3eC59jD55nX6HvYj6tE7ycbmj8ctBiGuCjLBvK6oFNz9");

#[program]
pub mod anchor_shared_vault {
    use super::*;

    const SHARED_VAULT_PDA_SEED: &[u8] = b"shared-vault";

    pub fn initialize(
        ctx: Context<Initialize>,
        _vault_account_bump: u8,
        initializer_amount: u64
    ) -> ProgramResult {
        ctx.accounts.shared_vault_account.initializer_key = *ctx.accounts.initializer.key;
        ctx.accounts.shared_vault_account.amount = initializer_amount;

        let (shared_vault_token_account_authority, _shared_vault_token_account_authority_bump) =
            Pubkey::find_program_address(&[SHARED_VAULT_PDA_SEED], ctx.program_id);

        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(shared_vault_token_account_authority),
        )?;

        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            ctx.accounts.shared_vault_account.amount,
        )?;
        
        Ok(())
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64
    ) -> ProgramResult {
        ctx.accounts.shared_vault_account.amount += amount;
        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            amount
        )?;

        Ok(())
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64
    ) -> ProgramResult {
        let (_vault_authority, vault_authority_bump) =
        Pubkey::find_program_address(&[SHARED_VAULT_PDA_SEED], ctx.program_id);
        let authority_seeds = &[&SHARED_VAULT_PDA_SEED[..], &[vault_authority_bump]];

        ctx.accounts.shared_vault_account.amount -= amount;
        token::transfer(
            ctx.accounts
                .into_transfer_to_user_token_account()
                .with_signer(&[&authority_seeds[..]]),
            amount
        )?;

        Ok(())
    }
}

#[account]
pub struct SharedVaultAccount {
    pub initializer_key: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(shared_vault_token_account_bump: u8, initializer_amount: u64)]
pub struct Initialize<'info> {
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [b"token-seed".as_ref()],
        bump = shared_vault_token_account_bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer,
    )]
    pub shared_vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = initializer_token_account.amount >= initializer_amount
    )]
    pub initializer_token_account: Account<'info, TokenAccount>,
    #[account(zero)]
    pub shared_vault_account: Box<Account<'info, SharedVaultAccount>>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> Initialize<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .initializer_token_account
                .to_account_info()
                .clone(),
            to: self.shared_vault_token_account.to_account_info().clone(),
            authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.shared_vault_token_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Deposit<'info> {
    #[account(mut, signer)]
    pub user: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub shared_vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_token_account.amount >= amount
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub shared_vault_account: Account<'info, SharedVaultAccount>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> Deposit<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .user_token_account
                .to_account_info()
                .clone(),
            to: self.shared_vault_token_account.to_account_info().clone(),
            authority: self.user.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(mut, signer)]
    pub user: AccountInfo<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub shared_vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = shared_vault_account.amount >= amount
    )]
    pub shared_vault_account: Account<'info, SharedVaultAccount>,
    pub shared_vault_token_account_authority: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> Withdraw<'info> {
    fn into_transfer_to_user_token_account(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .shared_vault_token_account
                .to_account_info()
                .clone(),
            to: self.user_token_account.to_account_info().clone(),
            authority: self.shared_vault_token_account_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}