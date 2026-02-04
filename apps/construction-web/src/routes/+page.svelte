<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import GlassCard from '$lib/components/GlassCard.svelte';
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
    Wrench
  } from 'lucide-svelte';
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
  <section class="pt-24 pb-16 md:pt-32 md:pb-24">
    <div class="page-container">
      <div class="max-w-3xl animate-in">
        <Badge variant="default" class="mb-6 animate-in animate-delay-1">
          Now available for Procore
        </Badge>
        <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-white animate-in animate-delay-2">
          The Automation Layer for Construction
        </h1>
        <p class="text-lg md:text-xl text-fg-tertiary max-w-2xl mb-8 animate-in animate-delay-3">
          Connect your project management tools to AI-powered workflows. Automate RFI tracking,
          submittal monitoring, daily reports, and more.
        </p>
        <div class="flex flex-wrap gap-4 mb-12 animate-in animate-delay-4">
          <Button variant="primary" href="/docs">Start Building</Button>
          <Button variant="secondary" href="/dashboard">View Dashboard</Button>
        </div>

        <!-- Proof Points -->
        <div
          class="flex flex-wrap gap-6 md:gap-8 pt-8 border-t border-white/10 animate-in animate-delay-5"
        >
          <div class="flex items-center gap-3 text-fg-tertiary text-sm">
            <div
              class="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <Check class="w-3 h-3 text-white/60" />
            </div>
            <span>30+ automation tools</span>
          </div>
          <div class="flex items-center gap-3 text-fg-tertiary text-sm">
            <div
              class="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <Check class="w-3 h-3 text-white/60" />
            </div>
            <span>AI-native architecture</span>
          </div>
          <div class="flex items-center gap-3 text-fg-tertiary text-sm">
            <div
              class="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <Check class="w-3 h-3 text-white/60" />
            </div>
            <span>Enterprise security</span>
          </div>
          <div class="flex items-center gap-3 text-fg-tertiary text-sm">
            <div
              class="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <Check class="w-3 h-3 text-white/60" />
            </div>
            <span>Sub-100ms response</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Problem Section -->
  <section class="py-16 md:py-24 border-t border-white/10">
    <div class="page-container">
      <div class="max-w-2xl mb-12 animate-in">
        <h2 class="text-3xl md:text-4xl font-semibold mb-4">Construction runs on busywork</h2>
        <p class="text-lg text-fg-tertiary">
          Project managers spend hours on tasks that should happen automatically.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard class="p-6 animate-in animate-delay-1">
          <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileText class="w-5 h-5 text-white/60" />
            RFI Follow-ups
          </h3>
          <p class="text-fg-tertiary text-sm">
            Manually checking which RFIs are overdue, sending reminder emails, updating
            spreadsheets. Every day.
          </p>
        </GlassCard>

        <GlassCard class="p-6 animate-in animate-delay-2">
          <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <ClipboardList class="w-5 h-5 text-white/60" />
            Submittal Tracking
          </h3>
          <p class="text-fg-tertiary text-sm">
            Digging through systems to find pending approvals, chasing down reviewers, reporting on
            status.
          </p>
        </GlassCard>

        <GlassCard class="p-6 animate-in animate-delay-3">
          <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <BarChart3 class="w-5 h-5 text-white/60" />
            Daily Reports
          </h3>
          <p class="text-fg-tertiary text-sm">
            Compiling information from multiple sources into summary emails. Time that should go to
            building.
          </p>
        </GlassCard>

        <GlassCard class="p-6 border-[#34d399]/30 bg-[#34d399]/5 animate-in animate-delay-4">
          <h3 class="text-lg font-semibold mb-2 flex items-center gap-2">
            <Sparkles class="w-5 h-5 text-white/60" />
            What if it just happened?
          </h3>
          <p class="text-fg-tertiary text-sm">
            WORKWAY connects to your tools and handles the routine. You define the workflow once,
            AI handles the rest.
          </p>
        </GlassCard>
      </div>
    </div>
  </section>

  <!-- How It Works Section -->
  <section class="py-16 md:py-24 border-t border-white/10">
    <div class="page-container">
      <div class="text-center max-w-2xl mx-auto mb-16 animate-in">
        <h2 class="text-3xl md:text-4xl font-semibold mb-4">How it works</h2>
        <p class="text-lg text-fg-tertiary">Three steps to automated workflows</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        <div class="text-center animate-in animate-delay-1">
          <div
            class="w-12 h-12 rounded-full bg-[#34d399] text-black font-bold text-xl flex items-center justify-center mx-auto mb-4"
          >
            1
          </div>
          <div class="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <Link class="w-6 h-6 text-white/60" />
          </div>
          <h3 class="text-lg font-semibold mb-2">Connect</h3>
          <p class="text-fg-tertiary text-sm">
            Link your Procore account with secure OAuth. Your data stays yours.
          </p>
        </div>

        <div class="text-center animate-in animate-delay-2">
          <div
            class="w-12 h-12 rounded-full bg-[#34d399] text-black font-bold text-xl flex items-center justify-center mx-auto mb-4"
          >
            2
          </div>
          <div class="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <Settings class="w-6 h-6 text-white/60" />
          </div>
          <h3 class="text-lg font-semibold mb-2">Configure</h3>
          <p class="text-fg-tertiary text-sm">
            Use pre-built templates or create custom workflows with natural language.
          </p>
        </div>

        <div class="text-center animate-in animate-delay-3">
          <div
            class="w-12 h-12 rounded-full bg-[#34d399] text-black font-bold text-xl flex items-center justify-center mx-auto mb-4"
          >
            3
          </div>
          <div class="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <Zap class="w-6 h-6 text-white/60" />
          </div>
          <h3 class="text-lg font-semibold mb-2">Automate</h3>
          <p class="text-fg-tertiary text-sm">
            Workflows run automatically. Get notified via email or Slack when things need attention.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Capabilities Section -->
  <section class="py-16 md:py-24 border-t border-white/10 bg-black/20">
    <div class="page-container">
      <div class="text-center max-w-2xl mx-auto mb-16 animate-in">
        <h2 class="text-3xl md:text-4xl font-semibold mb-4">Built for construction teams</h2>
        <p class="text-lg text-fg-tertiary">Every feature designed around how you actually work</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassCard
          icon={Bell}
          class="p-6 animate-in animate-delay-1"
        >
          <h3 class="text-base font-semibold mb-2">RFI Overdue Alerts</h3>
          <p class="text-fg-tertiary text-sm">
            Automatic notifications when RFIs need attention. Never miss a deadline.
          </p>
        </GlassCard>

        <GlassCard
          icon={ClipboardCheck}
          class="p-6 animate-in animate-delay-2"
        >
          <h3 class="text-base font-semibold mb-2">Submittal Monitoring</h3>
          <p class="text-fg-tertiary text-sm">
            Track approval status and get alerts for pending reviews and bottlenecks.
          </p>
        </GlassCard>

        <GlassCard
          icon={BarChart3}
          class="p-6 animate-in animate-delay-3"
        >
          <h3 class="text-base font-semibold mb-2">Weekly Summaries</h3>
          <p class="text-fg-tertiary text-sm">
            AI-generated project digests delivered every Monday morning.
          </p>
        </GlassCard>

        <GlassCard
          icon={FileEdit}
          class="p-6 animate-in animate-delay-4"
        >
          <h3 class="text-base font-semibold mb-2">Daily Log Reminders</h3>
          <p class="text-fg-tertiary text-sm">
            Afternoon prompts to ensure daily logs are submitted on time.
          </p>
        </GlassCard>

        <GlassCard
          icon={Zap}
          class="p-6 animate-in animate-delay-5"
        >
          <h3 class="text-base font-semibold mb-2">Instant Notifications</h3>
          <p class="text-fg-tertiary text-sm">
            Real-time alerts for new RFIs, approved submittals, and document uploads.
          </p>
        </GlassCard>

        <GlassCard
          icon={Wrench}
          class="p-6 animate-in animate-delay-6"
        >
          <h3 class="text-base font-semibold mb-2">Custom Workflows</h3>
          <p class="text-fg-tertiary text-sm">
            Build any automation you need. If you can describe it, WORKWAY can run it.
          </p>
        </GlassCard>
      </div>
    </div>
  </section>

  <!-- Integrations Section -->
  <section class="py-16 md:py-24 border-t border-white/10">
    <div class="page-container">
      <h2 class="text-xl md:text-2xl font-semibold text-center text-fg-tertiary mb-12 animate-in">
        Integrates with your stack
      </h2>
      <div class="flex flex-wrap justify-center gap-6 animate-in animate-delay-1">
        <div
          class="px-6 py-3 bg-white/5 border border-white/10 rounded-lg font-semibold text-fg-tertiary text-sm"
        >
          Procore
        </div>
        <div
          class="px-6 py-3 bg-white/5 border border-white/10 rounded-lg font-semibold text-fg-tertiary text-sm"
        >
          Slack
        </div>
        <div
          class="px-6 py-3 bg-white/5 border border-white/10 rounded-lg font-semibold text-fg-tertiary text-sm"
        >
          Email
        </div>
        <div
          class="px-6 py-3 bg-white/5 border border-white/10 rounded-lg font-semibold text-fg-tertiary text-sm"
        >
          Webhooks
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-16 md:py-24 border-t border-white/10">
    <div class="page-container">
      <div class="text-center max-w-xl mx-auto animate-in">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">Ready to automate?</h2>
        <p class="text-lg text-fg-tertiary mb-8">Stop spending time on tasks that should run themselves.</p>
        <div class="flex flex-wrap justify-center gap-4">
          <Button variant="primary" href="/docs">Get Started Free</Button>
          <Button variant="secondary" href="/dashboard">View Dashboard</Button>
        </div>
      </div>
    </div>
  </section>
</main>

<Footer />

<style>
  /* Ensure proper spacing and layout */
  section {
    scroll-margin-top: 4rem;
  }
</style>