"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { CheckCircle2 } from "lucide-react";
import VoiceWidget from "@/app/components/VoiceWidget";

export default function Home() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const router = useRouter();

  const handleStartOnboarding = () => {
    setIsWidgetOpen(true);
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <>
    <div className="min-h-screen lg:px-8 md:px-8 px-4 mx-auto w-full max-w-6xl">
      {/* Header */}
      <header className="fixed top-0 max-w-6xl w-full mx:px-8 lg:px-8 px-8 bg-background/80 backdrop-blur-sm z-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="https://storage.mlcdn.com/account_image/1108377/l1IcJ0rEULJH2abWtkQaEOpl3jJqZRVMyJloBUMd.jpg" alt="Kolos Network" className="h-10" />
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#about" className="text-sm hover:text-primary transition-colors">About</a>
              <a href="#membership" className="text-sm hover:text-primary transition-colors">Membership</a>
              <a href="#industries" className="text-sm hover:text-primary transition-colors">Industries</a>
              <a href="#testimonials" className="text-sm hover:text-primary transition-colors">Testimonials</a>
              <a href="#onboarding" className="text-sm hover:text-primary transition-colors">AI Onboarding</a>
              <a href="#faq" className="text-sm hover:text-primary transition-colors">FAQ</a>
              <a href="#contact" className="text-sm hover:text-primary transition-colors">Contact</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-12">
        <div className="container mx-auto">
          <div className="grid gap-12 items-center">
            <div>
              <h1 className="text-[68px] text-[#0d2d25] lg:text-6xl font-bold mb-6 leading-tight">
                Welcome to Kolos
              </h1>
              <h2 className="text-[48px] text-[#0d2d25] lg:text-4xl font-bold mb-6 leading-tight">
                The First AI powered Deal Flow Network for Business Owners
              </h2>
              <p className="text-lg text-[#0d2d25] mb-8">
                Grow your deal flow with AI and a vetted private network.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleStartOnboarding}
                >
                  Start AI Onboarding
                </Button>
                <Button 
                  size="lg" 
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={handleGoToDashboard}
                >
                  Go to Dashboard
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Takes about 3 minutes. No payment required. For select cases, we may invite you to a strategic call with our founder.
              </p>
            </div>
            <div>
              <img
                src="https://ext.same-assets.com/3822166527/290898014.jpeg"
                alt="Business Professional"
                className="rounded-lg shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>


      {/* Membership Tiers */}
      <section id="membership" className="py-16 px-12 bg-white">
        <div className="container mx-auto">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Every applicant is reviewed before access is granted. No payment required upfront.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Pillar */}
            <Card className="border-2">
              <CardHeader>
                <p className="text-sm text-muted-foreground mb-2">PILLAR</p>
                <CardTitle className="text-3xl mb-2">Pillar</CardTitle>
                <CardDescription>
                  For owners and CEOs who want structured deal flow for their business needs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">AI deal signals based on your focus</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">2 to 4 warm introductions per month where there is mutual interest</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">Access to selected Exchange Forum sessions and small groups</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">Light pipeline tracking with Kolos team support</p>
                  </div>
                </div>
                <Button className="w-full bg-secondary hover:bg-secondary/90">
                  Apply for Pillar
                </Button>
              </CardContent>
            </Card>

            {/* Vanguard */}
            <Card className="border-2">
              <CardHeader>
                <p className="text-sm text-muted-foreground mb-2">VANGUARD</p>
                <CardTitle className="text-3xl mb-2">Vanguard</CardTitle>
                <CardDescription>
                  For senior leaders pursuing proactive deal creation and deeper community access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6">
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">Deeper AI mapping of your investment or acquisition focus</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">Priority on proprietary deal flow from Kolos and Exchange Forum</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">ConOption to share mandates that Kolos can broadcast to the right members</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm">Invitations to closed-door briefings and small investor groups</p>
                  </div>
                </div>
                <Button className="w-full bg-secondary hover:bg-secondary/90">
                  Apply for Vanguard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-16 px-12">
        <div className="container mx-auto">
          <div className="max-w-3xl mb-12">
            <h2 className="text-4xl font-bold mb-6">Our Global Network & Industry Expertise</h2>
            <p className="text-muted-foreground mb-6">
              Kolos connects business owners, investors, and strategic partners across key industries. We use Signals backed research to open trusted deal flow, warm introductions, and expansion opportunities.
            </p>
            <Button className="bg-primary hover:bg-primary/90">
              Discover Our Approach
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Technology & AI",
                desc: "Signals backed outreach for AI, cybersecurity, data platforms, and SaaS."
              },
              {
                num: "02",
                title: "Capital & Family Offices",
                desc: "Warm access to LPs, family offices, co investors, and strategic capital partners."
              },
              {
                num: "03",
                title: "Real Estate & Data Infrastructure",
                desc: "Matchmaking across data centers, compute sites, and institutional CRE."
              },
              {
                num: "04",
                title: "Energy & Power Markets",
                desc: "IPP, utilities, storage, grid edge projects, and power for data centers and industry."
              },
              {
                num: "05",
                title: "Industrial & Manufacturing",
                desc: "OEM partnerships, contract manufacturing, critical materials, and productivity focused projects."
              },
              {
                num: "06",
                title: "Digital Assets & Tokenization",
                desc: "Tokenized funds, stablecoins, and RWA platforms connecting with trusted issuers, LPs, and real economy projects."
              }
            ].map((industry, i) => (
              <div key={i} className="border-b pb-4">
                <p className="text-4xl font-bold mb-4">{industry.num}</p>
                <h3 className="text-xl font-bold mb-2">{industry.title}</h3>
                <p className="text-sm text-muted-foreground italic">{industry.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Growth Section */}
      <section className="py-16 px-12 bg-white">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <img
                  src="https://storage.mlcdn.com/account_image/1108377/6dx9OWyd4Jqcxxt7AgFjnXSsoA7BiGtdOgdhFwsa.jpg"                alt="Business Leader"
                className="w-64 h-64 lg:w-80 lg:h-80 object-cover"
              />
            </div>
            <div>
              <h2 className="text-4xl font-bold mb-6">Accelerate Your Business Growth with Kolos</h2>
              <p className="text-muted-foreground mb-8">
                Our AI-driven approach identifies your best growth opportunities, forging meaningful connections that drive measurable impact. By uniting business leaders, corporate decision-makers, and top academic minds, we help you scale faster and more cost-effectively.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Button className="bg-secondary hover:bg-secondary/90">
                  Join Our Network
                </Button>
                <Button variant="outline">
                  Begin AI Voice Onboarding
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                No payment needed — join only if approved after your 5-min onboarding session.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <h3 className="text-5xl font-bold mb-2">10X</h3>
              <p className="text-muted-foreground">faster deal matchmaking through AI automation</p>
            </div>
            <div>
              <h3 className="text-5xl font-bold mb-2">1000+</h3>
              <p className="text-muted-foreground">high-value connections facilitated</p>
            </div>
            <div>
              <h3 className="text-5xl font-bold mb-2">$25M–$500M</h3>
              <p className="text-muted-foreground">in high-value deals</p>
            </div>
            <div>
              <h3 className="text-5xl font-bold mb-2">80%</h3>
              <p className="text-muted-foreground">of members see ROI in &lt;6 months</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-12 bg-white">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold mb-12">Why Members Love Kolos</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <img src="https://ext.same-assets.com/3822166527/2852276299.webp" alt="AI Matching" className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">AI Matching</h3>
              <p className="text-muted-foreground">
                AI Signal Engine that maps your mandates and surfaces specific people or companies from our network and extended ecosystem.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <img src="https://ext.same-assets.com/3822166527/3014038236.webp" alt="Forums" className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Forums</h3>
              <p className="text-muted-foreground">
                Private Zoom sessions and small groups where owners and investors share real cases. These sessions feed new signals back into Kolos.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-accent/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <img src="https://ext.same-assets.com/3822166527/1661520278.webp" alt="Pipeline & CRM" className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Pipeline & CRM</h3>
              <p className="text-muted-foreground">
                Light pipeline tracker so you and Kolos can see where each intro is, what was agreed, and what follow-up is needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-12 bg-primary text-white">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold mb-12">How It Works (After Onboarding)</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h3 className="text-6xl font-bold mb-4">1.</h3>
              <h4 className="text-xl font-bold mb-2">Map your focus</h4>
              <p className="text-white/90">
                During AI onboarding and a short call, we capture what you want to buy, sell, fund, or build.
              </p>
            </div>
            <div>
              <h3 className="text-6xl font-bold mb-4">2.</h3>
              <h4 className="text-xl font-bold mb-2">AI Signals and warm intros</h4>
              <p className="text-white/90">
                Kolos AI scans our forums, network, and partner lists to suggest concrete targets and partners. We send curated intros with context, not lists of names.
              </p>
            </div>
            <div>
              <h3 className="text-6xl font-bold mb-4">3.</h3>
              <h4 className="text-xl font-bold mb-2">Ongoing deal support</h4>
              <p className="text-white/90">
                We help you prioritize signals, prepare outreach, and keep the pipeline moving so you can close more high-value deals with less noise.
              </p>
            </div>
          </div>
          <div className="mt-8 bg-secondary text-foreground px-6 py-3 rounded inline-block">
            <p className="text-sm">Live Zoom sessions unlock only after onboarding approval.</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 px-12 bg-white">
        <div className="container mx-auto">
          <p className="text-sm text-muted-foreground mb-2">TESTIMONIALS</p>
          <h2 className="text-4xl font-bold mb-6">What Our Members Say</h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Backed by a global network of more than 2 000 owners and investors across Exchange Forum and Kolos.
          </p>

          <div className="space-y-8 max-w-3xl">
            <div className="border-b pb-8">
              <p className="text-lg mb-4">
                "Over the past year, Kolos facilitated 100+ high-value connections, resulting in $25M–$500M USD in new business opportunities across renewable energy, AI, and real estate."
              </p>
              <p className="font-semibold">— Ira Friedman, CEO of Material Technologies, Inc.</p>
            </div>
            <div className="border-b pb-8">
              <p className="text-lg mb-4">
                "Kolos transformed our global expansion strategy by connecting us to key decision-makers in half the usual time. Their AI-driven approach is a game-changer for enterprise growth."
              </p>
              <p className="font-semibold">— Alex Morgan, CEO of TechNova</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 px-12">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold mb-4">Meet the Minds Behind Kolos</h2>
          <p className="text-muted-foreground mb-12 max-w-3xl">
            At Kolos, we bring together a diverse group of visionary leaders and expert advisors. Each individual plays a crucial role in driving our AI-powered innovation, strategic partnerships, and global expansion efforts.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { name: "Volodymyr Berezhniy", role: "CEO. Leads overall strategy and global expansion initiatives.", img: "https://ext.same-assets.com/3822166527/2516971753.jpeg" },
              { name: "Dr. Marvin Karlow", role: "Strategic Capital Partner. Oversees capital strategy, investor relations and strategic partnerships, helping Kolos structure deals and scale new business lines.", img: "https://ext.same-assets.com/3822166527/1620090834.jpeg" },
              { name: "Nastya Shevchuk", role: "Operations. Ensures efficient processes and coordinates cross-functional teams.", img: "https://ext.same-assets.com/3822166527/2816353748.jpeg" },
              { name: "Dr. Alex Wissner-Gross", role: "Advisor, AI & Intelligence. Provides strategic guidance on AI methodologies and data-driven growth.", img: "https://ext.same-assets.com/3822166527/1868873944.png" },
              { name: "Pavlo Makukha", role: "Capital Markets & Real Estate (Compass, ex-Colliers). Guides Kolos members on office, retail and data-center land deals, connecting global investors with premier development opportunities.", img: "https://ext.same-assets.com/3822166527/274838138.jpeg" },
              { name: "Dr. Volodymyr Kuleshov", role: "AI Researcher (Stanford & Cornell Tech). Bridging cutting-edge machine learning research with real-world enterprise solutions.", img: "https://ext.same-assets.com/3822166527/1196320079.png" },
            ].map((member, i) => (
              <Card key={i} className="border-2">
                <CardContent className="pt-6">
                  <div className="flex gap-4 items-start">
                    <img src={member.img} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold mb-1">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-12 bg-white">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground mb-8">
            Here are answers to the most common questions about Kolos. If you don't find what you're looking for, feel free to contact us.
          </p>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How is Kolos different from other networks?</AccordionTrigger>
              <AccordionContent>
                Kolos uses AI-powered matchmaking to connect you directly with decision-makers. We focus on real business outcomes, not just introductions — delivering measurable ROI and deeper strategic alignment.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Who typically joins Kolos?</AccordionTrigger>
              <AccordionContent>
                Our members include global CEOs, founders, and senior executives—many are alumni of Harvard's executive programs like OPM, AMP, GMP, and PLD.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Are you affiliated with Harvard?</AccordionTrigger>
              <AccordionContent>
                While Kolos was founded by a Harvard alumnus, it operates independently and is not officially affiliated with Harvard University.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Is Kolos open to everyone?</AccordionTrigger>
              <AccordionContent>
                We maintain a high-value community by selectively vetting new prospects. Only qualified decision-makers who meet our criteria are invited to participate.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Is my data and information secure?</AccordionTrigger>
              <AccordionContent>
                Absolutely. We employ robust data privacy measures, and only essential information is shared with potential partners under strict confidentiality agreements.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 px-12 bg-cover bg-center relative" style={{ backgroundImage: 'url(https://ext.same-assets.com/3822166527/1666245196.jpeg)' }}>
        <div className="absolute inset-0 bg-white/90" />
        <div className="container mx-auto relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold mb-8">Ready to Accelerate Your Business Growth?</h2>

            <div className="space-y-4 mb-8">
              <div>
                <p className="text-sm font-semibold mb-1">ADDRESS</p>
                <p>3819 Maple Ave</p>
                <p>Dallas Texas 75219</p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">PHONE</p>
                <p>(214) 449 0450</p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">EMAIL</p>
                <p>vol@kolos.network</p>
              </div>
            </div>

            <Button className="bg-primary hover:bg-primary/90 mb-4">
              Start 7-Min AI Onboarding
            </Button>
            <p className="text-sm text-muted-foreground">
              (No payment required. You'll be invited to join only if approved.)
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
        <footer className="bg-primary text-white py-12 px-12">
        <div className="container mx-auto">
          <div className="flex justify-center mb-8">
            <img src="https://ext.same-assets.com/3822166527/1123501267.png" alt="Kolos Logo" className="h-16" />
          </div>

          <nav className="flex flex-wrap justify-center gap-6 mb-8">
            <a href="#about" className="hover:text-secondary transition-colors">About</a>
            <a href="#membership" className="hover:text-secondary transition-colors">Membership</a>
            <a href="#industries" className="hover:text-secondary transition-colors">Industries</a>
            <a href="#testimonials" className="hover:text-secondary transition-colors">Testimonials</a>
            <a href="#" className="hover:text-secondary transition-colors">People</a>
            <a href="#faq" className="hover:text-secondary transition-colors">FAQ</a>
            <a href="#" className="hover:text-secondary transition-colors">Privacy</a>
            <a href="#" className="hover:text-secondary transition-colors">Link</a>
          </nav>

          <div className="flex justify-center mb-8">
            <a href="#" className="hover:opacity-80 transition-opacity">
              <img src="https://ext.same-assets.com/3822166527/2197400819.png" alt="LinkedIn" className="h-6" />
            </a>
          </div>

          <p className="text-center text-sm text-white/80">
            © 2025 Kolos. All rights reserved. Kolos is an independent organization. We are not affiliated with Harvard University.
          </p>
        </div>
      </footer>

      {/* Voice Widget */}
      <VoiceWidget
        isOpen={isWidgetOpen}
        onClose={() => setIsWidgetOpen(false)}
        autoStart={true}
      />
    </div>
    </>
  );
}
