//! Gastown Coordinator CLI
//!
//! High-performance coordinator for WORKWAY harness.
//!
//! # Status
//!
//! This is a placeholder implementation. Use the TypeScript coordinator
//! in `packages/harness` until profiling shows a Rust port is needed.
//!
//! # Usage
//!
//! ```bash
//! # Start coordinator
//! gastown-coordinator start --max-workers 30
//!
//! # Check health
//! gastown-coordinator health
//!
//! # Show metrics
//! gastown-coordinator metrics
//! ```

use clap::{Parser, Subcommand};
use gastown::{Coordinator, CoordinatorConfig, Result};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "gastown-coordinator")]
#[command(about = "High-performance Gastown coordinator for WORKWAY harness")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the coordinator
    Start {
        /// Maximum number of concurrent workers
        #[arg(long, default_value = "30")]
        max_workers: usize,

        /// Minimum number of workers to maintain
        #[arg(long, default_value = "4")]
        min_workers: usize,

        /// Path to beads database
        #[arg(long, default_value = ".beads/issues.db")]
        db_path: String,
    },

    /// Check coordinator health
    Health,

    /// Show coordinator metrics
    Metrics,

    /// Run profiler to determine if Rust port is needed
    Profile {
        /// Target number of agents to simulate
        #[arg(long, default_value = "25")]
        agents: usize,

        /// Number of issues to simulate
        #[arg(long, default_value = "100")]
        issues: usize,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Start {
            max_workers,
            min_workers,
            db_path,
        } => {
            let config = CoordinatorConfig {
                max_workers,
                min_workers,
                db_path,
                ..Default::default()
            };

            println!("╔════════════════════════════════════════════════════════════════╗");
            println!("║           GASTOWN COORDINATOR (Rust - Placeholder)             ║");
            println!("╚════════════════════════════════════════════════════════════════╝");
            println!();
            println!("⚠️  This is a placeholder implementation.");
            println!("   Use the TypeScript coordinator until profiling shows need:");
            println!();
            println!("   import {{ runProfileSession }} from '@workwayco/harness';");
            println!("   const results = await runProfileSession({{ targetAgents: 25 }});");
            println!("   console.log(results.rustRecommendation);");
            println!();

            let coordinator = Coordinator::new(config)?;
            coordinator.run().await?;
        }

        Commands::Health => {
            println!("Health check: Not implemented (use TypeScript coordinator)");
        }

        Commands::Metrics => {
            println!("Metrics: Not implemented (use TypeScript coordinator)");
        }

        Commands::Profile { agents, issues } => {
            println!("╔════════════════════════════════════════════════════════════════╗");
            println!("║                    PROFILER RECOMMENDATION                      ║");
            println!("╚════════════════════════════════════════════════════════════════╝");
            println!();
            println!("To profile the TypeScript coordinator and determine if Rust is needed:");
            println!();
            println!("```typescript");
            println!("import {{ runProfileSession }} from '@workwayco/harness';");
            println!();
            println!("const results = await runProfileSession({{");
            println!("  targetAgents: {},", agents);
            println!("  targetIssues: {},", issues);
            println!("  durationMs: 60000,");
            println!("}});");
            println!();
            println!("console.log(results.report);");
            println!();
            println!("if (results.rustRecommendation.recommended) {{");
            println!("  console.log('Rust port recommended:', results.rustRecommendation.reasons);");
            println!("}}");
            println!("```");
            println!();
            println!("See packages/harness/RUST_PORT_PLAN.md for implementation details.");
        }
    }

    Ok(())
}
