use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use anchor_spl::token_interface::{TokenAccount, TokenInterface};

declare_id!("CtZrqYPSzPipUnxB55hBzCHrQxtBfWPujyrnDBDeWpWe");

#[program]
pub mod trustless {
    use super::*;

    /// Manually register a new agent
    pub fn register_agent(ctx: Context<RegisterAgent>, metadata_uri: String) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        agent_account.wallet = ctx.accounts.signer.key();
        agent_account.metadata_uri = metadata_uri.clone();
        agent_account.created_at = clock.unix_timestamp;
        agent_account.active = true;
        agent_account.auto_created = false;
        agent_account.total_weighted_rating = 0;
        agent_account.total_weight = 0;
        agent_account.avg_rating = 0.0;
        agent_account.last_update = clock.unix_timestamp;

        emit!(AgentRegistered {
            wallet: ctx.accounts.signer.key(),
            metadata_uri,
        });

        Ok(())
    }

    /// Update agent metadata
    pub fn update_agent(ctx: Context<UpdateAgent>, metadata_uri: String) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        agent_account.metadata_uri = metadata_uri.clone();
        agent_account.last_update = Clock::get()?.unix_timestamp;
        
        emit!(AgentUpdated {
            wallet: agent_account.wallet,
            metadata_uri,
        });
        
        Ok(())
    }

    /// Deactivate an agent
    pub fn deactivate_agent(ctx: Context<DeactivateAgent>) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        agent_account.active = false;
        agent_account.last_update = Clock::get()?.unix_timestamp;
        
        emit!(AgentDeactivated {
            wallet: agent_account.wallet,
        });
        
        Ok(())
    }

    /// Register a job (called by x402 facilitator)
    /// Supports lazy agent creation
    /// Verifies USDC payment from client to agent by checking transaction instructions
    pub fn register_job(
        ctx: Context<RegisterJob>,
        transfer_instruction_index: u8,
    ) -> Result<()> {
        // Get the job_record key before mutable borrow
        let job_record_key = ctx.accounts.job_record.key();
        
        let job_record = &mut ctx.accounts.job_record;
        let clock = Clock::get()?;

        // Verify payment: check that client token account transferred to agent token account
        let client_token = &ctx.accounts.client_token_account;
        let agent_token = &ctx.accounts.agent_token_account;
        
        // Verify both accounts use the same USDC mint
        require!(
            client_token.mint == agent_token.mint,
            ErrorCode::TokenMintMismatch
        );
        
        // Verify token accounts belong to correct owners
        require!(
            client_token.owner == ctx.accounts.client_wallet.key(),
            ErrorCode::InvalidClientTokenAccount
        );
        require!(
            agent_token.owner == ctx.accounts.agent_wallet.key(),
            ErrorCode::InvalidAgentTokenAccount
        );
        
        // Load and verify the transfer instruction from the current transaction
        let ixs = ctx.accounts.instruction_sysvar.to_account_info();
        let transfer_ix = load_instruction_at_checked(
            transfer_instruction_index as usize,
            &ixs,
        )?;
        
        // Verify it's a token program instruction (matches the token_program account)
        require!(
            transfer_ix.program_id == ctx.accounts.token_program.key(),
            ErrorCode::InvalidTransferInstruction
        );
        
        // Parse SPL Token Transfer instruction (instruction discriminator = 3)
        // Format: [discriminator: u8, amount: u64]
        require!(
            transfer_ix.data.len() >= 9 && transfer_ix.data[0] == 3,
            ErrorCode::InvalidTransferInstruction
        );
        
        // Extract transfer amount from instruction data
        let amount_bytes: [u8; 8] = transfer_ix.data[1..9]
            .try_into()
            .map_err(|_| ErrorCode::InvalidTransferAmount)?;
        let payment_amount = u64::from_le_bytes(amount_bytes);
        
        // Verify the transfer instruction accounts match our expected accounts
        // SPL Token Transfer accounts: [source, destination, authority]
        require!(
            transfer_ix.accounts.len() >= 3,
            ErrorCode::InvalidTransferInstruction
        );
        require!(
            transfer_ix.accounts[0].pubkey == client_token.key(),
            ErrorCode::TransferSourceMismatch
        );
        require!(
            transfer_ix.accounts[1].pubkey == agent_token.key(),
            ErrorCode::TransferDestinationMismatch
        );
        require!(
            transfer_ix.accounts[2].pubkey == ctx.accounts.client_wallet.key(),
            ErrorCode::TransferAuthorityMismatch
        );

        // Lazy agent creation if account doesn't exist yet
        let agent_account_info = ctx.accounts.agent_account.to_account_info();
        
        if agent_account_info.data_is_empty() {
            // Create the account
            let space = 320;
            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(space);
            
            anchor_lang::system_program::create_account(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::CreateAccount {
                        from: ctx.accounts.client_wallet.to_account_info(),
                        to: agent_account_info.clone(),
                    },
                ),
                lamports,
                space as u64,
                ctx.program_id,
            )?;
            
            // Initialize agent account data
            let agent_data = AgentAccount {
                wallet: ctx.accounts.agent_wallet.key(),
                metadata_uri: String::new(),
                created_at: clock.unix_timestamp,
                active: true,
                auto_created: true,
                total_weighted_rating: 0,
                total_weight: 0,
                avg_rating: 0.0,
                last_update: clock.unix_timestamp,
            };
            
            // Serialize and write data
            let mut data = agent_account_info.try_borrow_mut_data()?;
            agent_data.try_serialize(&mut &mut data[..])?;

            emit!(AgentAutoCreated {
                wallet: ctx.accounts.agent_wallet.key(),
            });
        }

        // Create job record
        job_record.job_id = job_record_key;
        job_record.client_wallet = ctx.accounts.client_wallet.key();
        job_record.agent_wallet = ctx.accounts.agent_wallet.key();
        job_record.payment_tx = ctx.accounts.payment_tx.key();
        job_record.payment_amount = payment_amount;
        job_record.created_at = clock.unix_timestamp;

        emit!(JobRegistered {
            job_id: job_record.job_id,
            agent_wallet: job_record.agent_wallet,
            client_wallet: job_record.client_wallet,
            payment_amount,
        });

        Ok(())
    }

    /// Submit feedback for a completed job
    pub fn submit_feedback(
        ctx: Context<SubmitFeedback>,
        rating: u8,
        comment_uri: Option<String>,
    ) -> Result<()> {
        require!(rating >= 1 && rating <= 5, ErrorCode::InvalidRating);

        let job_record = &ctx.accounts.job_record;
        let agent_account = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        // Validate client matches job record
        require!(
            job_record.client_wallet == ctx.accounts.client_wallet.key(),
            ErrorCode::UnauthorizedClient
        );

        // Validate proof of payment matches job record
        require!(
            job_record.payment_tx == ctx.accounts.proof_of_payment.key(),
            ErrorCode::InvalidProofOfPayment
        );

        // Get feedback_record key before mutable borrow
        let feedback_record_key = ctx.accounts.feedback_record.key();
        let feedback_record = &mut ctx.accounts.feedback_record;
        
        // Create feedback record
        feedback_record.feedback_id = feedback_record_key;
        feedback_record.job_id = job_record.job_id;
        feedback_record.client_wallet = ctx.accounts.client_wallet.key();
        feedback_record.agent_wallet = job_record.agent_wallet;
        feedback_record.rating = rating;
        feedback_record.comment_uri = comment_uri;
        feedback_record.proof_of_payment = ctx.accounts.proof_of_payment.key();
        feedback_record.payment_amount = job_record.payment_amount;
        feedback_record.timestamp = clock.unix_timestamp;

        // Update agent reputation with payment-weighted scoring
        let payment_amount = job_record.payment_amount as u128;
        let rating_value = rating as u128;

        agent_account.total_weighted_rating += rating_value * payment_amount;
        agent_account.total_weight += payment_amount;
        agent_account.avg_rating = 
            (agent_account.total_weighted_rating as f64 / agent_account.total_weight as f64) as f32;
        agent_account.last_update = clock.unix_timestamp;

        emit!(FeedbackSubmitted {
            job_id: job_record.job_id,
            client_wallet: ctx.accounts.client_wallet.key(),
            agent_wallet: job_record.agent_wallet,
            rating,
            payment_amount: job_record.payment_amount,
        });

        emit!(ReputationUpdated {
            agent_wallet: agent_account.wallet,
            new_avg_rating: agent_account.avg_rating,
        });

        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct AgentAccount {
    pub wallet: Pubkey,                  // 32
    pub metadata_uri: String,            // 4 + max 200 = 204
    pub created_at: i64,                 // 8
    pub active: bool,                    // 1
    pub auto_created: bool,              // 1
    pub total_weighted_rating: u128,     // 16
    pub total_weight: u128,              // 16
    pub avg_rating: f32,                 // 4
    pub last_update: i64,                // 8
}

#[account]
pub struct JobRecord {
    pub job_id: Pubkey,                  // 32
    pub client_wallet: Pubkey,           // 32
    pub agent_wallet: Pubkey,            // 32
    pub payment_tx: Pubkey,              // 32
    pub payment_amount: u64,             // 8
    pub created_at: i64,                 // 8
}

#[account]
pub struct FeedbackRecord {
    pub feedback_id: Pubkey,             // 32
    pub job_id: Pubkey,                  // 32
    pub client_wallet: Pubkey,           // 32
    pub agent_wallet: Pubkey,            // 32
    pub rating: u8,                      // 1
    pub comment_uri: Option<String>,     // 1 + 4 + max 200 = 205
    pub proof_of_payment: Pubkey,        // 32
    pub payment_amount: u64,             // 8
    pub timestamp: i64,                  // 8
}

// ============================================================================
// Context Structures
// ============================================================================

// total space is 298 now, use 320
// space = 8  // discriminator
//         + 32   // wallet: Pubkey
//         + 4 + 200 // metadata_uri: String (4 bytes prefix + 200 bytes max)
//         + 8    // created_at
//         + 1    // active
//         + 1    // auto_created
//         + 16   // total_weighted_rating
//         + 16   // total_weight
//         + 4    // avg_rating
//         + 8    // last_update

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = signer,
        space = 320,
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", signer.key().as_ref()],
        bump,
        has_one = wallet @ ErrorCode::UnauthorizedAgent
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(constraint = wallet.key() == signer.key())]
    pub signer: Signer<'info>,
    
    /// CHECK: Wallet address from agent_account
    pub wallet: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct DeactivateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", signer.key().as_ref()],
        bump,
        has_one = wallet @ ErrorCode::UnauthorizedAgent
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(constraint = wallet.key() == signer.key())]
    pub signer: Signer<'info>,
    
    /// CHECK: Wallet address from agent_account
    pub wallet: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RegisterJob<'info> {
    /// Agent account - can be either existing or newly created
    /// Uses zero_copy pattern to avoid init/mut conflict
    #[account(
        mut,
        seeds = [b"agent", agent_wallet.key().as_ref()],
        bump
    )]
    pub agent_account: SystemAccount<'info>,
    
    #[account(
        init,
        payer = client_wallet,
        space = 8 + std::mem::size_of::<JobRecord>(),
        seeds = [b"job", payment_tx.key().as_ref()],
        bump
    )]
    pub job_record: Account<'info, JobRecord>,
    
    /// CHECK: Agent wallet address
    pub agent_wallet: UncheckedAccount<'info>,
    
    /// Client's USDC token account (sender)
    #[account(
        constraint = client_token_account.owner == client_wallet.key() @ ErrorCode::InvalidClientTokenAccount
    )]
    pub client_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// Agent's USDC token account (receiver)
    #[account(
        constraint = agent_token_account.owner == agent_wallet.key() @ ErrorCode::InvalidAgentTokenAccount
    )]
    pub agent_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Payment transaction reference (used as job identifier)
    pub payment_tx: UncheckedAccount<'info>,
    
    /// CHECK: Instruction sysvar for reading transaction instructions
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub client_wallet: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SubmitFeedback<'info> {
    #[account(
        seeds = [b"job", proof_of_payment.key().as_ref()],
        bump
    )]
    pub job_record: Account<'info, JobRecord>,
    
    #[account(
        mut,
        seeds = [b"agent", job_record.agent_wallet.as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(
        init,
        payer = client_wallet,
        space = 400,  // 8 (discriminator) + 32 (feedback_id) + 32 (job_id) + 32 (client) + 32 (agent) + 1 (rating) + 205 (comment_uri) + 32 (proof_of_payment) + 8 (payment_amount) + 8 (timestamp) = 390, use 400 for safety
        seeds = [b"feedback", job_record.job_id.as_ref()],
        bump
    )]
    pub feedback_record: Account<'info, FeedbackRecord>,
    
    #[account(mut)]
    pub client_wallet: Signer<'info>,
    
    /// CHECK: Payment transaction reference for validation
    pub proof_of_payment: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct AgentRegistered {
    pub wallet: Pubkey,
    pub metadata_uri: String,
}

#[event]
pub struct AgentAutoCreated {
    pub wallet: Pubkey,
}

#[event]
pub struct AgentUpdated {
    pub wallet: Pubkey,
    pub metadata_uri: String,
}

#[event]
pub struct AgentDeactivated {
    pub wallet: Pubkey,
}

#[event]
pub struct JobRegistered {
    pub job_id: Pubkey,
    pub agent_wallet: Pubkey,
    pub client_wallet: Pubkey,
    pub payment_amount: u64,
}

#[event]
pub struct FeedbackSubmitted {
    pub job_id: Pubkey,
    pub client_wallet: Pubkey,
    pub agent_wallet: Pubkey,
    pub rating: u8,
    pub payment_amount: u64,
}

#[event]
pub struct ReputationUpdated {
    pub agent_wallet: Pubkey,
    pub new_avg_rating: f32,
}

// ============================================================================
// Error Codes
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating,
    
    #[msg("Client does not match job record")]
    UnauthorizedClient,
    
    #[msg("Agent wallet does not match agent account")]
    UnauthorizedAgent,
    
    #[msg("Proof of payment does not match job record")]
    InvalidProofOfPayment,
    
    #[msg("Token mint mismatch between client and agent accounts")]
    TokenMintMismatch,
    
    #[msg("Client token account owner does not match client")]
    InvalidClientTokenAccount,
    
    #[msg("Agent token account owner does not match agent")]
    InvalidAgentTokenAccount,
    
    #[msg("Invalid transfer instruction")]
    InvalidTransferInstruction,
    
    #[msg("Invalid transfer amount format")]
    InvalidTransferAmount,
    
    #[msg("Transfer source account mismatch")]
    TransferSourceMismatch,
    
    #[msg("Transfer destination account mismatch")]
    TransferDestinationMismatch,
    
    #[msg("Transfer authority mismatch")]
    TransferAuthorityMismatch,
}
