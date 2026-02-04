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
            '30+ automation tools',
            'AI-native architecture',
            'Enterprise security',
            'Sub-100ms response'
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
    <h2 class="text-3xl md:text-4xl font-semibold mb-4">Three steps to automated workflows</h2>
    <p class="text-lg text-white/60 mb-16">Connect, configure, automate.</p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-left">
      {#each [
        { num: '1', icon: Link, title: 'Connect', desc: 'Link your Procore account with secure OAuth. Your data stays yours.' },
        { num: '2', icon: Settings, title: 'Configure', desc: 'Use pre-built templates or create custom workflows with natural language.' },
        { num: '3', icon: Zap, title: 'Automate', desc: 'Workflows run automatically. Get notified via email or Slack when things need attention.' },
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

  <!-- Capabilities Section -->
  <OutcomeSection label="Capabilities" class="bg-black/20">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="text-3xl md:text-4xl font-semibold mb-4">Built for construction teams</h2>
      <p class="text-lg text-white/60">Every feature designed around how you actually work</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each [
        { icon: Bell, title: 'RFI Overdue Alerts', desc: 'Automatic notifications when RFIs need attention. Never miss a deadline.' },
        { icon: ClipboardCheck, title: 'Submittal Monitoring', desc: 'Track approval status and get alerts for pending reviews and bottlenecks.' },
        { icon: BarChart3, title: 'Weekly Summaries', desc: 'AI-generated project digests delivered every Monday morning.' },
        { icon: FileEdit, title: 'Daily Log Reminders', desc: 'Afternoon prompts to ensure daily logs are submitted on time.' },
        { icon: Zap, title: 'Instant Notifications', desc: 'Real-time alerts for new RFIs, approved submittals, and document uploads.' },
        { icon: Wrench, title: 'Custom Workflows', desc: 'Build any automation you need. If you can describe it, WORKWAY can run it.' },
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
