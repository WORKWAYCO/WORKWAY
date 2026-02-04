<script lang="ts">
  import {
    Header,
    Footer,
    Button,
    Badge,
    OutcomeSection,
    LiquidGlass,
    TiltGlass,
    IntegrationFlow,
    ScrollReveal,
    TextReveal,
  } from '$lib/components';
  import {
    Check,
    FileText,
    ClipboardList,
    BarChart3,
    Sparkles,
    Link,
    Settings,
    Zap,
    Bell,
    ClipboardCheck,
    FileEdit,
    Wrench,
    Building2,
    HardHat,
    MessageSquare,
    Mail,
  } from 'lucide-svelte';
  import { STAGGER } from '$lib/design-system';
</script>

<svelte:head>
  <title>WORKWAY - The Automation Layer for Construction</title>
  <meta
    name="description"
    content="AI-powered workflow automation for construction. Connect your project data to intelligent automations that handle RFIs, submittals, daily logs, and more."
  />
  <meta property="og:title" content="WORKWAY - The Automation Layer for Construction" />
  <meta
    property="og:description"
    content="AI-powered workflow automation for construction. Connect your project data to intelligent automations that handle RFIs, submittals, daily logs, and more."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://construction.workway.co" />
</svelte:head>

<Header />

<main class="relative z-10">
  <!-- Hero Section -->
  <OutcomeSection isHero padding="lg" class="pt-24">
    <div class="max-w-3xl">
      <ScrollReveal>
        <Badge variant="default" class="mb-6">
          Now available for Procore
        </Badge>
      </ScrollReveal>
      
      <ScrollReveal delay={STAGGER.fast}>
        <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-white">
          <TextReveal text="The Automation Layer" style="fade" duration={600} />
          <br />
          <span class="text-white/60">for Construction</span>
        </h1>
      </ScrollReveal>
      
      <ScrollReveal delay={STAGGER.fast * 2}>
        <p class="text-lg md:text-xl text-white/60 max-w-2xl mb-8">
          Connect your project management tools to AI-powered workflows. Automate RFI tracking,
          submittal monitoring, daily reports, and more.
        </p>
      </ScrollReveal>
      
      <ScrollReveal delay={STAGGER.fast * 3}>
        <div class="flex flex-wrap gap-4 mb-12">
          <Button variant="primary" href="/docs">Start Building</Button>
          <Button variant="secondary" href="/dashboard">View Dashboard</Button>
        </div>
      </ScrollReveal>

      <!-- Proof Points -->
      <ScrollReveal delay={STAGGER.fast * 4}>
        <div class="flex flex-wrap gap-6 md:gap-8 pt-8 border-t border-white/10">
          {#each [
            'MCP-native (Claude, Codex)',
            'AI Skills for RFIs & Logs',
            'Procore sandbox + production',
            'Workers AI powered'
          ] as point}
            <div class="flex items-center gap-3 text-white/60 text-sm">
              <div class="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                <Check class="w-3 h-3 text-white/60" />
              </div>
              <span>{point}</span>
            </div>
          {/each}
        </div>
      </ScrollReveal>
    </div>
  </OutcomeSection>

  <!-- Problem Section -->
  <OutcomeSection label="The problem">
    <div class="max-w-2xl mb-12">
      <h2 class="text-3xl md:text-4xl font-semibold mb-4">Construction runs on busywork</h2>
      <p class="text-lg text-white/60">
        Project managers spend hours on tasks that should happen automatically.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ScrollReveal delay={0}>
        <TiltGlass padding="1.5rem" maxTilt={6} glareOpacity={0.1}>
          <div>
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              <FileText class="w-5 h-5 text-white/60" />
              RFI Follow-ups
            </h3>
            <p class="text-white/60 text-sm">
              Manually checking which RFIs are overdue, sending reminder emails, updating
              spreadsheets. Every day.
            </p>
          </div>
        </TiltGlass>
      </ScrollReveal>

      <ScrollReveal delay={STAGGER.fast}>
        <TiltGlass padding="1.5rem" maxTilt={6} glareOpacity={0.1}>
          <div>
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              <ClipboardList class="w-5 h-5 text-white/60" />
              Submittal Tracking
            </h3>
            <p class="text-white/60 text-sm">
              Digging through systems to find pending approvals, chasing down reviewers, reporting on
              status.
            </p>
          </div>
        </TiltGlass>
      </ScrollReveal>

      <ScrollReveal delay={STAGGER.fast * 2}>
        <TiltGlass padding="1.5rem" maxTilt={6} glareOpacity={0.1}>
          <div>
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              <BarChart3 class="w-5 h-5 text-white/60" />
              Daily Reports
            </h3>
            <p class="text-white/60 text-sm">
              Compiling information from multiple sources into summary emails. Time that should go to
              building.
            </p>
          </div>
        </TiltGlass>
      </ScrollReveal>

      <ScrollReveal delay={STAGGER.fast * 3}>
        <LiquidGlass padding="1.5rem" intensity="medium" class="border border-[#34d399]/20">
          <div>
            <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
              <Sparkles class="w-5 h-5 text-[#34d399]" />
              What if it just happened?
            </h3>
            <p class="text-white/60 text-sm">
              WORKWAY connects to your tools and handles the routine. You define the workflow once,
              AI handles the rest.
            </p>
          </div>
        </LiquidGlass>
      </ScrollReveal>
    </div>
  </OutcomeSection>

  <!-- How It Works Section -->
  <OutcomeSection label="How it works" centered>
    <h2 class="text-3xl md:text-4xl font-semibold mb-4">MCP-first, Skills-second</h2>
    <p class="text-lg text-white/60 mb-16">Connectivity earns trust. Intelligence delivers value.</p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-left">
      {#each [
        { num: '1', icon: Link, title: 'Connect via MCP', desc: 'Secure OAuth to Procore. Works with Claude Desktop, Codex, or any MCP-compatible tool.' },
        { num: '2', icon: Sparkles, title: 'Use AI Skills', desc: 'draft_rfi, daily_log_summary, submittal_review. AI produces outcomes, not just data.' },
        { num: '3', icon: HardHat, title: 'Human reviews', desc: 'Skills flag issues and draft responses. You approve before anything is submitted.' },
      ] as step, i}
        <ScrollReveal delay={STAGGER.fast * i} class="text-center">
          <div class="w-12 h-12 rounded-full bg-[#34d399] text-black font-bold text-xl flex items-center justify-center mx-auto mb-4">
            {step.num}
          </div>
          <div class="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <svelte:component this={step.icon} class="w-6 h-6 text-white/60" />
          </div>
          <h3 class="text-lg font-semibold mb-2">{step.title}</h3>
          <p class="text-white/60 text-sm">{step.desc}</p>
        </ScrollReveal>
      {/each}
    </div>
  </OutcomeSection>

  <!-- Two-Layer Architecture Section -->
  <OutcomeSection label="Architecture" class="bg-black/20">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="text-3xl md:text-4xl font-semibold mb-4">Two layers. One outcome.</h2>
      <p class="text-lg text-white/60">MCP for connectivity. Skills for intelligence.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <!-- Intelligence Layer -->
      <ScrollReveal delay={0}>
        <LiquidGlass padding="2rem" intensity="medium" class="h-full border border-[#34d399]/20">
          <div>
            <Badge variant="default" class="mb-4 bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20">Intelligence Layer</Badge>
            <h3 class="text-xl font-semibold mb-3">AI Skills that produce outcomes</h3>
            <ul class="space-y-2 text-white/60 text-sm">
              <li class="flex items-start gap-2">
                <Check class="w-4 h-4 text-[#34d399] mt-0.5 shrink-0" />
                <span><strong>draft_rfi</strong> — AI generates professional RFIs from your intent</span>
              </li>
              <li class="flex items-start gap-2">
                <Check class="w-4 h-4 text-[#34d399] mt-0.5 shrink-0" />
                <span><strong>daily_log_summary</strong> — Executive reports from daily logs</span>
              </li>
              <li class="flex items-start gap-2">
                <Check class="w-4 h-4 text-[#34d399] mt-0.5 shrink-0" />
                <span><strong>submittal_review</strong> — Flag compliance issues automatically</span>
              </li>
            </ul>
            <p class="text-white/40 text-xs mt-4">Powered by Cloudflare Workers AI</p>
          </div>
        </LiquidGlass>
      </ScrollReveal>

      <!-- Automation Layer -->
      <ScrollReveal delay={STAGGER.fast}>
        <TiltGlass padding="2rem" maxTilt={4} glareOpacity={0.08} class="h-full">
          <div>
            <Badge variant="default" class="mb-4">Automation Layer (MCP)</Badge>
            <h3 class="text-xl font-semibold mb-3">Universal connectivity via MCP</h3>
            <ul class="space-y-2 text-white/60 text-sm">
              <li class="flex items-start gap-2">
                <Check class="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                <span><strong>Procore OAuth</strong> — Secure connection to sandbox & production</span>
              </li>
              <li class="flex items-start gap-2">
                <Check class="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                <span><strong>15+ MCP tools</strong> — RFIs, daily logs, submittals, schedule</span>
              </li>
              <li class="flex items-start gap-2">
                <Check class="w-4 h-4 text-white/40 mt-0.5 shrink-0" />
                <span><strong>Works everywhere</strong> — Claude Desktop, Codex, any MCP client</span>
              </li>
            </ul>
            <p class="text-white/40 text-xs mt-4">Model Context Protocol standard</p>
          </div>
        </TiltGlass>
      </ScrollReveal>
    </div>
  </OutcomeSection>

  <!-- Capabilities Section -->
  <OutcomeSection label="Capabilities">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="text-3xl md:text-4xl font-semibold mb-4">Built for construction teams</h2>
      <p class="text-lg text-white/60">Every feature designed around how you actually work</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each [
        { icon: Sparkles, title: 'AI-Drafted RFIs', desc: 'Describe what you need to ask. AI generates a professional RFI with spec references.' },
        { icon: BarChart3, title: 'Executive Summaries', desc: 'Daily logs transformed into weekly reports. Metrics, events, recommendations.' },
        { icon: ClipboardCheck, title: 'Submittal Triage', desc: 'Automatic compliance review. Critical items flagged. Pattern analysis included.' },
        { icon: Bell, title: 'Smart Notifications', desc: 'Get alerted when RFIs are overdue, submittals need review, or data is missing.' },
        { icon: HardHat, title: 'Construction-Native', desc: 'CSI MasterFormat specs, real drawing references, industry terminology.' },
        { icon: Wrench, title: 'MCP Compatible', desc: 'Works with Claude Desktop, Codex, or any tool that supports MCP.' },
      ] as cap, i}
        <ScrollReveal delay={STAGGER.fast * i}>
          <TiltGlass padding="1.5rem" maxTilt={4} glareOpacity={0.08} class="h-full">
            <div>
              <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <svelte:component this={cap.icon} class="w-5 h-5 text-white/60" />
              </div>
              <h3 class="text-base font-semibold mb-2">{cap.title}</h3>
              <p class="text-white/60 text-sm">{cap.desc}</p>
            </div>
          </TiltGlass>
        </ScrollReveal>
      {/each}
    </div>
  </OutcomeSection>

  <!-- Integrations Section -->
  <OutcomeSection label="Integrations" centered>
    <h2 class="text-xl md:text-2xl font-semibold text-white/60 mb-12">
      Integrates with your stack
    </h2>
    
    <IntegrationFlow
      integrations={[
        { label: 'Pro' },
        { label: 'Slk' },
        { label: '@' },
        { label: 'Web' },
      ]}
      description="Procore → WORKWAY → Slack, Email, Webhooks"
      showConnectors={true}
      animateFlow={true}
      intensity="medium"
      class="max-w-2xl mx-auto"
    />

    <div class="flex flex-wrap justify-center gap-4 mt-12">
      {#each [
        { name: 'Procore', icon: Building2 },
        { name: 'Slack', icon: MessageSquare },
        { name: 'Email', icon: Mail },
        { name: 'Webhooks', icon: Zap },
      ] as integration}
        <div class="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
          <svelte:component this={integration.icon} class="w-4 h-4 text-white/40" />
          <span class="text-sm font-medium text-white/60">{integration.name}</span>
        </div>
      {/each}
    </div>
  </OutcomeSection>

  <!-- CTA Section -->
  <OutcomeSection centered padding="lg">
    <LiquidGlass padding="3rem" intensity="strong" class="max-w-xl mx-auto">
      <div class="text-center">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">Ready to automate?</h2>
        <p class="text-lg text-white/60 mb-8">Stop spending time on tasks that should run themselves.</p>
        <div class="flex flex-wrap justify-center gap-4">
          <Button variant="primary" href="/docs">Get Started Free</Button>
          <Button variant="secondary" href="/dashboard">View Dashboard</Button>
        </div>
      </div>
    </LiquidGlass>
  </OutcomeSection>
</main>

<Footer />

<style>
  section {
    scroll-margin-top: 4rem;
  }
</style>
