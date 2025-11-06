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

        agent_account.agent = ctx.accounts.agent.key();
        agent_account.metadata_uri = metadata_uri.clone();
        agent_account.created_at = clock.unix_timestamp;
        agent_account.active = true;
        agent_account.auto_created = false;
        agent_account.total_weighted_rating = 0;
        agent_account.total_weight = 0;
        agent_account.avg_rating = 0.0;
        agent_account.last_update = clock.unix_timestamp;

        emit!(AgentRegistered {
            agent: ctx.accounts.agent.key(),
            metadata_uri,
        });

        Ok(())
    }

    /// Update agent metadata
    pub fn update_agent(ctx: Context<UpdateAgent>, metadata_uri: String) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        agent_account.metadata_uri = metadata_uri;
        agent_account.last_update = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Deactivate an agent
    pub fn deactivate_agent(ctx: Context<DeactivateAgent>) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        agent_account.active = false;
        agent_account.last_update = Clock::get()?.unix_timestamp;
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
        
        let agent_account = &mut ctx.accounts.agent_account;
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
            client_token.owner == ctx.accounts.client.key(),
            ErrorCode::InvalidClientTokenAccount
        );
        require!(
            agent_token.owner == ctx.accounts.agent.key(),
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
            transfer_ix.accounts[2].pubkey == ctx.accounts.client.key(),
            ErrorCode::TransferAuthorityMismatch
        );

        // Lazy agent creation if account is being initialized
        if agent_account.agent == Pubkey::default() {
            agent_account.agent = ctx.accounts.agent.key();
            agent_account.metadata_uri = String::new();
            agent_account.created_at = clock.unix_timestamp;
            agent_account.active = true;
            agent_account.auto_created = true;
            agent_account.total_weighted_rating = 0;
            agent_account.total_weight = 0;
            agent_account.avg_rating = 0.0;
            agent_account.last_update = clock.unix_timestamp;

            emit!(AgentAutoCreated {
                agent: ctx.accounts.agent.key(),
            });
        }

        // Create job record
        job_record.job_id = job_record_key;
        job_record.client = ctx.accounts.client.key();
        job_record.agent = ctx.accounts.agent.key();
        job_record.payment_tx = ctx.accounts.payment_tx.key();
        job_record.payment_amount = payment_amount;
        job_record.created_at = clock.unix_timestamp;

        emit!(JobRegistered {
            job_id: job_record.job_id,
            agent: job_record.agent,
            client: job_record.client,
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
        let feedback_record = &mut ctx.accounts.feedback_record;
        let agent_account = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        // Validate client matches job record
        require!(
            job_record.client == ctx.accounts.client.key(),
            ErrorCode::UnauthorizedClient
        );

        // Validate proof of payment matches job record
        require!(
            job_record.payment_tx == ctx.accounts.proof_of_payment.key(),
            ErrorCode::InvalidProofOfPayment
        );

        // Create feedback record
        feedback_record.job_id = job_record.job_id;
        feedback_record.client = ctx.accounts.client.key();
        feedback_record.agent = job_record.agent;
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
            client: ctx.accounts.client.key(),
            rating,
            payment_amount: job_record.payment_amount,
        });

        emit!(ReputationUpdated {
            agent: agent_account.agent,
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
    pub agent: Pubkey,                   // 32
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
    pub client: Pubkey,                  // 32
    pub agent: Pubkey,                   // 32
    pub payment_tx: Pubkey,              // 32
    pub payment_amount: u64,             // 8
    pub created_at: i64,                 // 8
}

#[account]
pub struct FeedbackRecord {
    pub job_id: Pubkey,                  // 32
    pub client: Pubkey,                  // 32
    pub agent: Pubkey,                   // 32
    pub rating: u8,                      // 1
    pub comment_uri: Option<String>,     // 1 + 4 + max 200 = 205
    pub proof_of_payment: Pubkey,        // 32
    pub payment_amount: u64,             // 8
    pub timestamp: i64,                  // 8
}

// ============================================================================
// Context Structures
// ============================================================================

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = agent,
        space = 8 + std::mem::size_of::<AgentAccount>(),
        seeds = [b"agent", agent.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(mut)]
    pub agent: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.key().as_ref()],
        bump,
        has_one = agent
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.key().as_ref()],
        bump,
        has_one = agent
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterJob<'info> {
    #[account(
        init,
        payer = facilitator,
        space = 8 + std::mem::size_of::<AgentAccount>(),
        seeds = [b"agent", agent.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(
        init,
        payer = facilitator,
        space = 8 + std::mem::size_of::<JobRecord>(),
        seeds = [b"job", payment_tx.key().as_ref()],
        bump
    )]
    pub job_record: Account<'info, JobRecord>,
    
    /// CHECK: Agent wallet address
    pub agent: UncheckedAccount<'info>,
    
    /// CHECK: Client wallet address
    pub client: UncheckedAccount<'info>,
    
    /// Client's USDC token account (sender)
    #[account(
        constraint = client_token_account.owner == client.key() @ ErrorCode::InvalidClientTokenAccount
    )]
    pub client_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// Agent's USDC token account (receiver)
    #[account(
        constraint = agent_token_account.owner == agent.key() @ ErrorCode::InvalidAgentTokenAccount
    )]
    pub agent_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Payment transaction reference (used as job identifier)
    pub payment_tx: UncheckedAccount<'info>,
    
    /// CHECK: Instruction sysvar for reading transaction instructions
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub facilitator: Signer<'info>,
    
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
        seeds = [b"agent", job_record.agent.as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(
        init,
        payer = client,
        space = 8 + std::mem::size_of::<FeedbackRecord>(),
        seeds = [b"feedback", job_record.job_id.as_ref()],
        bump
    )]
    pub feedback_record: Account<'info, FeedbackRecord>,
    
    #[account(mut)]
    pub client: Signer<'info>,
    
    /// CHECK: Payment transaction reference for validation
    pub proof_of_payment: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub metadata_uri: String,
}

#[event]
pub struct AgentAutoCreated {
    pub agent: Pubkey,
}

#[event]
pub struct JobRegistered {
    pub job_id: Pubkey,
    pub agent: Pubkey,
    pub client: Pubkey,
    pub payment_amount: u64,
}

#[event]
pub struct FeedbackSubmitted {
    pub job_id: Pubkey,
    pub client: Pubkey,
    pub rating: u8,
    pub payment_amount: u64,
}

#[event]
pub struct ReputationUpdated {
    pub agent: Pubkey,
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
