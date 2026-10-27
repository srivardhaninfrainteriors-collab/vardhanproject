import React, { useEffect, useRef, useState } from "react";
import {
  brand,
  services,
  inspiration,
  projects,
  journal,
  processSteps,
  campaigns,
  url,
  asset,
  pageRoutes,
} from "./content.js";
import {
  initAnalytics,
  track,
  consent,
  saveConsent,
  attribution,
} from "./analytics.js";
const Arrow = ({ down = false }) => (
  <span aria-hidden="true" className="arrow">
    {down ? "↓" : "↗"}
  </span>
);
const Kicker = ({ children, light = false }) => (
  <div className={`kicker ${light ? "light" : ""}`}>
    <span />
    {children}
  </div>
);
function Picture({ name, alt = "", className = "", hero = false }) {
  return (
    <img
      className={className}
      src={asset(
        `images/${name}-${hero && name === "living" ? 2000 : 1200}.webp`,
      )}
      srcSet={`${asset(`images/${name}-640.webp`)} 640w, ${asset(`images/${name}-1200.webp`)} 1200w${name === "living" ? `, ${asset("images/living-2000.webp")} 2000w` : ""}`}
      sizes={hero ? "100vw" : "(max-width: 700px) 100vw, 50vw"}
      width="1200"
      height="900"
      alt={alt}
      loading={hero ? "eager" : "lazy"}
      fetchPriority={hero ? "high" : "auto"}
    />
  );
}
function Button({ href, children, outline = false, onClick, className = "" }) {
  return (
    <a
      href={href || url("contact/")}
      onClick={
        onClick ||
        (() =>
          track("consultation_request", { placement: className || "button" }))
      }
      className={`button ${outline ? "outline" : ""} ${className}`}
    >
      {children}
      <Arrow />
    </a>
  );
}
function Logo() {
  return (
    <a
      className="brand"
      href={url()}
      aria-label="Srivardhan Infra and Interiors home"
    >
      <img src={asset("logo.png")} width="101" height="60" alt="" />
      <span>
        SRIVARDHAN<small>INFRA & INTERIORS</small>
      </span>
    </a>
  );
}
function Header({ home = false, campaign = false }) {
  const [scrolled, setScrolled] = useState(false);
  const dialog = useRef(null);
  const toggle = useRef(null);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const close = () => {
    dialog.current.close();
    document.body.style.overflow = "";
    toggle.current?.focus();
  };
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header
        className={`site-header ${home ? "over-hero" : ""} ${scrolled ? "scrolled" : ""}`}
      >
        <Logo />
        {campaign ? (
          <a
            className="header-call"
            href={`tel:${brand.telephone}`}
            onClick={() => track("click_to_call")}
          >
            Let’s talk · {brand.phone}
          </a>
        ) : (
          <>
            <nav className="desktop-nav" aria-label="Main navigation">
              <a href={url("studio/")}>The Studio</a>
              <div className="nav-dropdown">
                <a href={url("services/")}>
                  Our Expertise <span aria-hidden="true">⌄</span>
                </a>
                <div className="dropdown-panel">
                  {services.map((s) => (
                    <a key={s.slug} href={url(`services/${s.slug}/`)}>
                      {s.name}
                      <Arrow />
                    </a>
                  ))}
                </div>
              </div>
              <a href={url("projects/")}>Our Work</a>
              <a href={url("journal/")}>The Journal</a>
            </nav>
            <a
              className="header-cta"
              href={url("contact/")}
              onClick={() =>
                track("consultation_request", { placement: "header" })
              }
            >
              Let’s create together <Arrow />
            </a>
            <button
              ref={toggle}
              className="menu-toggle"
              aria-label="Open navigation"
              onClick={() => {
                dialog.current.showModal();
                document.body.style.overflow = "hidden";
              }}
            >
              <span />
              <span />
            </button>
          </>
        )}
      </header>
      <dialog
        ref={dialog}
        className="mobile-menu"
        aria-label="Site navigation"
        onCancel={() => {
          document.body.style.overflow = "";
        }}
      >
        <div className="menu-top">
          <Logo />
          <button aria-label="Close navigation" onClick={close}>
            ×
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {[
            ["The Studio", "studio/"],
            ["Our Expertise", "services/"],
            ["Our Work", "projects/"],
            ["The Journal", "journal/"],
            ["Let’s create together", "contact/"],
          ].map(([label, path], i) => (
            <a href={url(path)} key={path}>
              <small>0{i + 1}</small>
              {label}
              <Arrow />
            </a>
          ))}
        </nav>
        <a href={`tel:${brand.telephone}`}>{brand.phone}</a>
        <p>Vijayawada, Andhra Pradesh</p>
      </dialog>
    </>
  );
}
function Hero() {
  return (
    <section className="hero">
      <Picture
        name="living"
        alt="Sunlit interior with natural timber, textured upholstery and generous living space — design inspiration"
        hero
      />
      <div className="hero-shade" />
      <div className="hero-content">
        <Kicker light>CONSIDERED DESIGN. LASTING IMPRESSIONS.</Kicker>
        <h1>
          Spaces That <em>Inspire.</em>
          <br />
          Structures That <em>Endure.</em>
        </h1>
        <p>
          Thoughtfully designed interiors. Distinguished spaces.
          <br className="desktop-break" /> Construction built around your
          vision.
        </p>
        <div className="hero-actions">
          <Button>Book a Private Consultation</Button>
          <a className="text-link" href={url("projects/")}>
            Explore Our Projects <Arrow />
          </a>
        </div>
      </div>
      <div className="hero-bottom">
        <a href="#philosophy" className="scroll-cue">
          <span>↓</span> SCROLL TO DISCOVER
        </a>
        <span className="hero-place">
          VIJAYAWADA, ANDHRA PRADESH <span className="small-dot" />
        </span>
        <span className="image-note">
          Design inspiration · reference photography
        </span>
      </div>
      <div className="hero-index" aria-hidden="true">
        <b>01</b>
        <span />
        04
      </div>
    </section>
  );
}
function Philosophy({ full = false }) {
  return (
    <section id="philosophy" className="philosophy section-pad">
      <div className="philosophy-copy reveal">
        <Kicker>THE SRIVARDHAN PHILOSOPHY</Kicker>
        <h2>
          Beautiful spaces.
          <br />
          <em>Meaningful living.</em>
        </h2>
        <p className="lead-copy">
          A space should do more than look beautiful.
          <br />
          It should feel like it belongs to you.
        </p>
        <p>
          At SRIVARDHAN INFRA & INTERIORS, the conversation begins with your
          vision. We bring interiors, architectural thinking and construction
          together around the way you want to live and work.
        </p>
        <p>
          From the first idea to the smallest detail, our approach is
          considered: thoughtful materials, purposeful spaces and a clear
          understanding of what matters to you.
        </p>
        {!full && (
          <a className="line-link" href={url("studio/")}>
            Discover our approach <Arrow />
          </a>
        )}
      </div>
      <div className="philosophy-art reveal">
        <Picture
          name="detail"
          alt="Considered proportions and natural finishes — reference interior"
        />
        <span className="vertical-note">SPACE. LIGHT. MATERIAL. MEANING.</span>
        <div className="image-caption">
          <span>01 / A considered perspective</span>
          <span>Reference imagery</span>
        </div>
      </div>
    </section>
  );
}
function Expertise({ all = false }) {
  const display = all
    ? services
    : [
        services[0],
        services[3],
        services[2],
        services[4],
        services[6],
        services[7],
      ];
  return (
    <section className="expertise section-pad">
      <div className="section-heading reveal">
        <div>
          <Kicker>OUR SIGNATURE EXPERTISE</Kicker>
          <h2>
            Many possibilities.
            <br />
            <em>One considered approach.</em>
          </h2>
        </div>
        <p>
          From a deeply personal home to an ambitious commercial space, every
          project begins with understanding its purpose.
        </p>
      </div>
      <div className="service-grid">
        {display.map((s, i) => (
          <a
            className="service-tile reveal"
            key={s.slug}
            href={url(`services/${s.slug}/`)}
          >
            <Picture name={s.image} alt={`${s.label} — design inspiration`} />
            <div className="tile-top">
              <span>0{i + 1}</span>
              <Arrow />
            </div>
            <div className="tile-copy">
              <span>{s.category}</span>
              <h3>{s.label}</h3>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
function Gallery({ full = false }) {
  const [filter, setFilter] = useState("All");
  const selected = inspiration.filter(
    (i) => filter === "All" || i.category === filter,
  );
  return (
    <section id="work" className="gallery section-pad">
      <div className="section-heading reveal">
        <div>
          <Kicker>SPACES, THROUGH OUR LENS</Kicker>
          <h2>
            A feeling.
            <br />
            <em>A world of possibilities.</em>
          </h2>
        </div>
        <div className="gallery-intro">
          <p>
            A curated exploration of the spaces, materials and ideas that move
            us.
          </p>
          <a className="line-link" href={url("contact/")}>
            Discuss your project <Arrow />
          </a>
        </div>
      </div>
      <div className="gallery-toolbar">
        <div className="filters" aria-label="Filter design inspiration">
          {["All", "Interiors", "Architecture", "Commercial"].map((f) => (
            <button
              key={f}
              aria-pressed={f === filter}
              className={f === filter ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <span>DESIGN INSPIRATION / NOT COMPLETED WORK</span>
      </div>
      <div className="gallery-grid">
        {selected.slice(0, full ? 4 : 3).map((i, index) => (
          <a
            className={`project-card project-${index}`}
            href={url(`inspiration/${i.slug}/`)}
            key={i.slug}
          >
            <div className="project-image">
              <Picture
                name={i.image}
                alt={`${i.title} — reference photography`}
              />
              <span className="project-view">
                Explore the idea <Arrow />
              </span>
            </div>
            <div className="project-caption">
              <div>
                <small>{i.category} / REFERENCE STUDY</small>
                <h3>{i.title}</h3>
              </div>
              <Arrow />
            </div>
          </a>
        ))}
      </div>
      <p className="honesty-note">
        These photographs illustrate design directions and are not SRIVARDHAN
        projects. Ask us about relevant work during your consultation.
      </p>
      {full && (
        <div className="portfolio-note">
          <h3>Our work, shared with care.</h3>
          <p>
            Client-approved project photography and case studies will be
            published here when available. Speak with the team about relevant
            examples and current project details.
          </p>
          <Button>Talk about your project</Button>
        </div>
      )}
      {projects.length > 0 && (
        <div className="gallery-grid">
          {projects.map((p) => (
            <a href={url(`projects/${p.slug}/`)} key={p.slug}>
              <img src={asset(p.cover)} alt={p.title} loading="lazy" />
              <h3>{p.title}</h3>
              <p>
                {p.location} · {p.scope}
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
function Process() {
  const [step, setStep] = useState(0);
  return (
    <section className="process section-pad">
      <div className="section-heading reveal">
        <div>
          <Kicker light>THE ART OF EXECUTION</Kicker>
          <h2>
            From a first thought
            <br />
            to <em>the final detail.</em>
          </h2>
        </div>
        <p>
          A clear path makes room for better decisions.
          <br />
          Our proposed journey, shaped to your project’s agreed scope.
        </p>
      </div>
      <div className="process-tabs" role="tablist" aria-label="Project journey">
        {processSteps.map(([title], i) => (
          <button
            role="tab"
            aria-selected={step === i}
            aria-controls="process-panel"
            id={`process-tab-${i}`}
            tabIndex={step === i ? 0 : -1}
            onKeyDown={(e) => {
              let n;
              if (e.key === "ArrowRight") n = (i + 1) % 8;
              if (e.key === "ArrowLeft") n = (i + 7) % 8;
              if (e.key === "Home") n = 0;
              if (e.key === "End") n = 7;
              if (n !== undefined) {
                e.preventDefault();
                setStep(n);
                document.getElementById(`process-tab-${n}`).focus();
              }
            }}
            onClick={() => setStep(i)}
            className={step === i ? "active" : ""}
            key={title}
          >
            <span>0{i + 1}</span>
            <b>{title}</b>
          </button>
        ))}
      </div>
      <div
        className="process-detail"
        role="tabpanel"
        id="process-panel"
        aria-labelledby={`process-tab-${step}`}
      >
        <span className="process-number">0{step + 1}</span>
        <div>
          <h3>{processSteps[step][0]}</h3>
          <p>{processSteps[step][1]}</p>
        </div>
        <div className="process-arrows">
          <button
            aria-label="Previous stage"
            onClick={() => setStep((step + 7) % 8)}
          >
            ←
          </button>
          <button
            aria-label="Next stage"
            onClick={() => setStep((step + 1) % 8)}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
function Materials() {
  return (
    <section className="materials">
      <div className="material-photo reveal">
        <Picture
          name="detail"
          alt="A palette of natural surfaces and warm finishes — reference photography"
        />
        <span>THE LANGUAGE OF MATERIALS</span>
      </div>
      <div className="material-copy reveal">
        <Kicker>CRAFTED IN THE DETAILS</Kicker>
        <h2>
          The things you see.
          <br />
          <em>And the things you feel.</em>
        </h2>
        <p>
          The warmth of timber. The quiet strength of stone. Light falling
          exactly where it should. It is the relationship between these details
          that gives a space its character.
        </p>
        <p>
          Explore materials for their beauty, their purpose and the way they
          will live with you.
        </p>
        <div className="material-tags">
          <span>Timber & texture</span>
          <span>Stone & surface</span>
          <span>Light & proportion</span>
          <span>Joinery & detail</span>
        </div>
        <a
          className="line-link"
          href={url("journal/a-considered-material-palette/")}
        >
          A more considered palette <Arrow />
        </a>
      </div>
    </section>
  );
}
function Confidence() {
  return (
    <section className="confidence section-pad">
      <Kicker>A CONVERSATION BUILT ON CLARITY</Kicker>
      <h2>
        Confidence begins with
        <br />
        <em>the right questions.</em>
      </h2>
      <div className="confidence-grid">
        {[
          [
            "01",
            "Your vision, understood",
            "Share your priorities, references and everyday needs before defining the brief.",
          ],
          [
            "02",
            "The scope, made clear",
            "Discuss inclusions, materials, responsibilities and budget before committing.",
          ],
          [
            "03",
            "Details, discussed openly",
            "Ask about relevant work, site conditions and the next steps for your project.",
          ],
        ].map(([n, t, d]) => (
          <div key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
function LeadForm({ service = "", campaign = "" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [stage, setStage] = useState(1),
    [selected, setSelected] = useState(service),
    [state, setState] = useState("idle"),
    [message, setMessage] = useState(""),
    [handoff, setHandoff] = useState("");
  const form = useRef(null);
  const leadId = useRef(null);
  const status = useRef(null);
  const endpoint =
    import.meta.env.VITE_LEAD_API_URL || (import.meta.env.DEV ? "/api" : "");
  async function submit(e) {
    e.preventDefault();
    if (state === "sending") return;
    const phone = form.current.elements.phone;
    const digits = phone.value.replace(/\D/g, "");
    phone.setCustomValidity(
      digits.length < 10 ||
        digits.length > 15 ||
        !/^[+0-9 ()-]+$/.test(phone.value)
        ? "Enter a phone number with 10–15 digits."
        : "",
    );
    if (!form.current.reportValidity()) return;
    if (stage === 1) {
      setStage(2);
      requestAnimationFrame(() =>
        form.current.querySelector('[name="location"]')?.focus(),
      );
      return;
    }
    const data = Object.fromEntries(new FormData(form.current));
    data.consent = data.consent === "on";
    data.analyticsConsent = !!consent()?.analytics;
    data.marketingConsent = !!consent()?.marketing;
    data.attribution = attribution();
    data.page = window.location.pathname;
    data.campaign = campaign;
    data.requestId = leadId.current || (leadId.current = crypto.randomUUID());
    data.service = selected;
    if (!data.consent) return;
    if (!endpoint) {
      const lines = [
        `Hello SRIVARDHAN, I would like a private consultation.`,
        ...[
          "name",
          "phone",
          "service",
          "location",
          "property",
          "area",
          "budget",
          "timeline",
          "company",
          "message",
        ]
          .filter((k) => data[k])
          .map((k) => `${k}: ${data[k]}`),
        "I consent to being contacted about this inquiry.",
      ];
      setHandoff(
        `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`,
      );
      setState("handoff");
      setMessage(
        "Your inquiry is ready. Open WhatsApp and press Send to share it with our team. It has not been submitted yet.",
      );
      return;
    }
    setState("sending");
    setMessage("");
    try {
      const r = await fetch(`${endpoint.replace(/\/$/, "")}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000),
      });
      const result = await r.json();
      if (!r.ok || !result.id)
        throw new Error(result.error || "Your inquiry could not be saved.");
      setState("success");
      setMessage(
        `Your consultation request has been saved. Reference ${result.id.slice(0, 8).toUpperCase()}. The team can review your project details and contact you. For a time-sensitive inquiry, call us directly.`,
      );
      track("generate_lead", {
        event_id: result.id,
        service: selected,
        campaign,
      });
      form.current.reset();
    } catch (err) {
      setState("error");
      setMessage(
        `${err.name === "TimeoutError" ? "The connection timed out. You can retry the same inquiry safely." : err.message} You can also reach us using the contact links.`,
      );
    }
  }
  useEffect(() => {
    if (["success", "error", "handoff"].includes(state))
      status.current?.focus();
  }, [state]);
  return (
    <form
      className="lead-form"
      onSubmit={submit}
      ref={form}
      onChange={() => {
        if (state === "handoff") {
          setHandoff("");
          setMessage("");
          setState("idle");
        }
      }}
    >
      <div className="form-top">
        <span>YOUR NEXT CHAPTER STARTS HERE</span>
        <span>0{stage} / 02</span>
      </div>
      <h3>
        {stage === 1
          ? "Tell us a little about you."
          : "A few details about your vision."}
      </h3>
      <p className="form-subtitle">
        {stage === 1
          ? "A simple first step. A thoughtful conversation to follow."
          : "These details help us prepare for your conversation."}
      </p>
      {state !== "success" && (
        <fieldset className="form-fields" disabled={state === "sending"}>
          <div hidden={stage !== 1}>
            <div className="form-row">
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Full name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Phone number
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91"
                  required
                  onInput={(e) => e.currentTarget.setCustomValidity("")}
                  title="Enter a phone number with 10–15 digits"
                  maxLength={20}
                />
              </label>
            </div>
            <label>
              I’m interested in
              <select
                name="service"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                required
              >
                <option value="">Select your project</option>
                {services.map((s) => (
                  <option key={s.slug}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div hidden={stage !== 2}>
            <div className="form-row">
              <label>
                Project location
                <input
                  name="location"
                  placeholder="City / neighbourhood"
                  maxLength={150}
                  required={stage === 2}
                />
              </label>
              <label>
                Property type
                <select name="property" required={stage === 2} defaultValue="">
                  <option value="">Select property type</option>
                  {[
                    "Apartment",
                    "Independent home",
                    "Villa",
                    "Plot",
                    "Office",
                    "Retail",
                    "Development",
                    "Other",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Indicative budget
                <select name="budget" defaultValue="Not decided">
                  <option>Not decided</option>
                  {(selected.includes("construction") ||
                  selected.includes("partnership") ||
                  selected.includes("Villas")
                    ? [
                        "₹25–50 lakh",
                        "₹50 lakh–1 crore",
                        "₹1–3 crore",
                        "₹3 crore+",
                      ]
                    : [
                        "Under ₹10 lakh",
                        "₹10–25 lakh",
                        "₹25–50 lakh",
                        "₹50 lakh+",
                      ]
                  ).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Expected timeline
                <select name="timeline" defaultValue="Exploring options">
                  {[
                    "Exploring options",
                    "Within 3 months",
                    "3–6 months",
                    "6–12 months",
                    "More than a year",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Approximate area <span>(optional, sq ft)</span>
              <input
                name="area"
                type="number"
                min="1"
                max="10000000"
                placeholder="e.g. 2000"
              />
            </label>
            {selected.includes("partnership") && (
              <label>
                Organisation / project name
                <input name="company" maxLength={150} />
              </label>
            )}
            <label>
              Anything else you’d like us to know? <span>(optional)</span>
              <textarea
                name="message"
                rows={2}
                maxLength={2000}
                placeholder="Your ideas, priorities or questions"
              />
            </label>
            <label className="consent-check">
              <input name="consent" type="checkbox" required={stage === 2} />
              <span>
                I agree to be contacted about this inquiry and have read the{" "}
                <a href={url("privacy/")}>privacy notice</a>.
              </span>
            </label>
          </div>
          <div className="honeypot" aria-hidden="true">
            <label>
              Leave empty
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="form-actions">
            {stage === 2 && (
              <button
                type="button"
                className="back-button"
                onClick={() => {
                  setStage(1);
                  setHandoff("");
                  setState("idle");
                }}
              >
                ← Back
              </button>
            )}
            <button
              className="button"
              type="submit"
              disabled={!ready || state === "sending"}
            >
              {stage === 1
                ? "Begin your consultation"
                : state === "sending"
                  ? "Saving your inquiry…"
                  : endpoint
                    ? "Request a private consultation"
                    : "Prepare WhatsApp inquiry"}
              <Arrow />
            </button>
          </div>
        </fieldset>
      )}
      {message && (
        <div
          tabIndex={-1}
          ref={status}
          className={`form-status ${state}`}
          role={state === "error" ? "alert" : "status"}
        >
          {message}
          {handoff && (
            <a
              className="button"
              href={handoff}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("whatsapp_click", { placement: "form_handoff" })
              }
            >
              Open WhatsApp & send <Arrow />
            </a>
          )}
        </div>
      )}
      <p className="form-footnote">
        {endpoint
          ? "Your details are used to respond to your project inquiry."
          : "Prefer a conversation? This inquiry opens in WhatsApp for you to send."}
      </p>
      <noscript>
        <p>
          Please enable JavaScript to use this form, or contact us using the
          telephone and WhatsApp links alongside it.
        </p>
      </noscript>
    </form>
  );
}
function Consultation({ service = "", campaign = "" }) {
  return (
    <section id="consultation" className="consultation section-pad">
      <div className="consultation-copy reveal">
        <Kicker>LET’S BEGIN SOMETHING MEANINGFUL</Kicker>
        <h2>
          Let’s create
          <br />
          something
          <br />
          <em>extraordinary.</em>
        </h2>
        <p>
          A home. A workspace. A new possibility.
          <br />
          Tell us what you have in mind.
        </p>
        <div className="contact-links">
          <a
            href={`tel:${brand.telephone}`}
            onClick={() =>
              track("click_to_call", { placement: "consultation" })
            }
          >
            <small>CALL US</small>
            {brand.phone}
            <Arrow />
          </a>
          <a
            href={`https://wa.me/${brand.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("whatsapp_click", { placement: "consultation" })
            }
          >
            <small>LET’S TALK</small>Start a WhatsApp conversation
            <Arrow />
          </a>
        </div>
        <p className="next-step">
          First, we understand your project. Then we discuss the appropriate
          consultation, site review and scope.
        </p>
      </div>
      <LeadForm service={service} campaign={campaign} />
    </section>
  );
}
function Journal({ full = false }) {
  return (
    <section className="journal section-pad">
      <div className="section-heading">
        <div>
          <Kicker>NOTES ON CONSIDERED LIVING</Kicker>
          <h2>
            The <em>Journal.</em>
          </h2>
        </div>
        {!full && (
          <a className="line-link" href={url("journal/")}>
            All stories <Arrow />
          </a>
        )}
      </div>
      <div className="journal-grid">
        {journal.map((j) => (
          <a href={url(`journal/${j.slug}/`)} key={j.slug}>
            <Picture
              name={j.image}
              alt={`${j.category} reference photography`}
            />
            <small>{j.category} / FIELD NOTES</small>
            <h3>
              {j.title}
              <Arrow />
            </h3>
            <p>{j.intro}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
function Footer({ onPrivacy }) {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div>
          <Logo />
          <p>
            Thoughtful interiors.
            <br />
            Distinguished spaces.
            <br />
            Built around you.
          </p>
          <a
            className="line-link"
            href={brand.instagram}
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow our perspective <Arrow />
          </a>
        </div>
        <div>
          <h3>EXPLORE</h3>
          <a href={url("studio/")}>The Studio</a>
          <a href={url("services/")}>Our Expertise</a>
          <a href={url("projects/")}>Our Work & Inspiration</a>
          <a href={url("journal/")}>The Journal</a>
          <a href={url("contact/")}>Get in Touch</a>
        </div>
        <div>
          <h3>OUR EXPERTISE</h3>
          {services.map((s) => (
            <a href={url(`services/${s.slug}/`)} key={s.slug}>
              {s.name}
            </a>
          ))}
        </div>
        <div>
          <h3>LET’S TALK</h3>
          <a
            href={`tel:${brand.telephone}`}
            onClick={() => track("click_to_call")}
          >
            {brand.phone}
          </a>
          <a
            href="tel:+916301997874"
            onClick={() =>
              track("click_to_call", { placement: "footer_secondary" })
            }
          >
            {brand.secondPhone}
          </a>
          <a href={`mailto:${brand.email}`}>{brand.email}</a>
          <p>
            Vijayawada
            <br />
            Andhra Pradesh, India
          </p>
          <a href={brand.instagram} target="_blank" rel="noopener noreferrer">
            Instagram <Arrow />
          </a>
        </div>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        SRIVARDHAN<span>SPACES WITH PURPOSE.</span>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} SRIVARDHAN INFRA & INTERIORS</span>
        <div>
          <a href={url("privacy/")}>Privacy</a>
          <a href={url("terms/")}>Terms</a>
          <button onClick={onPrivacy}>Cookie preferences</button>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
function CookieSettings({ open, onClose }) {
  const [analytics, setAnalytics] = useState(false),
    [marketing, setMarketing] = useState(false);
  useEffect(() => {
    if (open) {
      const saved = consent();
      setAnalytics(!!saved?.analytics);
      setMarketing(!!saved?.marketing);
    }
  }, [open]);
  if (!open) return null;
  return (
    <section className="cookie-panel" aria-label="Cookie preferences">
      <div>
        <h3>A little room for privacy.</h3>
        <p>
          Essential features work without tracking. Optional analytics help us
          understand visits; marketing cookies support campaign measurement.{" "}
          <a href={url("privacy/")}>Read more</a>
        </p>
      </div>
      <div className="cookie-choices">
        <label>
          <input
            type="checkbox"
            checked={analytics}
            onChange={(e) => setAnalytics(e.target.checked)}
          />{" "}
          Analytics
        </label>
        <label>
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />{" "}
          Marketing
        </label>
        <button
          onClick={() => {
            saveConsent({ analytics: false, marketing: false });
            onClose();
          }}
        >
          Essential only
        </button>
        <button
          className="button"
          onClick={() => {
            saveConsent({ analytics, marketing });
            onClose();
          }}
        >
          Save choices
        </button>
      </div>
    </section>
  );
}
function PageIntro({ eyebrow, title, description }) {
  return (
    <section className="page-intro section-pad">
      <Kicker>{eyebrow}</Kicker>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </section>
  );
}
function ServicePage({ service: s }) {
  return (
    <>
      <section className="service-hero">
        <div>
          <Kicker>{s.label.toUpperCase()} / VIJAYAWADA</Kicker>
          <h1>{s.title}</h1>
          <p>{s.intro}</p>
          <Button href="#consultation">Discuss your project</Button>
        </div>
        <figure>
          <Picture
            name={s.image}
            alt={`${s.name} — reference photography`}
            hero
          />
          <figcaption>
            Design inspiration · not completed company work
          </figcaption>
        </figure>
      </section>
      <section className="scope section-pad">
        <div>
          <Kicker>THOUGHTFULLY DEFINED</Kicker>
          <h2>
            Made for your
            <br />
            <em>way of living.</em>
          </h2>
          <p>{s.benefit}</p>
        </div>
        <div>
          {s.scope.map((item, i) => (
            <div className="scope-item" key={item}>
              <span>0{i + 1}</span>
              <h3>{item}</h3>
              <Arrow />
            </div>
          ))}
          <p className="small-note">
            Final inclusions, responsibilities and timelines are confirmed in
            your written proposal.
          </p>
        </div>
      </section>
      <section className="faq section-pad">
        <Kicker>A LITTLE MORE CLARITY</Kicker>
        <h2>
          Your questions,
          <br />
          <em>considered.</em>
        </h2>
        {s.faq.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span>+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
        <p>
          Ask the team for relevant project examples during your consultation.
        </p>
      </section>
      <Consultation service={s.name} />
      <section className="related section-pad">
        <Kicker>EXPLORE FURTHER</Kicker>
        {services
          .filter((x) => x.category === s.category && x.slug !== s.slug)
          .slice(0, 2)
          .map((x) => (
            <a
              className="scope-item"
              key={x.slug}
              href={url(`services/${x.slug}/`)}
            >
              <h3>{x.name}</h3>
              <Arrow />
            </a>
          ))}
      </section>
    </>
  );
}
function InspirationPage({ item: i }) {
  return (
    <>
      <PageIntro
        eyebrow={`${i.category.toUpperCase()} / DESIGN REFERENCE`}
        title={i.title}
        description={i.desc}
      />
      <figure className="wide-figure">
        <Picture
          name={i.image}
          hero
          alt={`${i.title} — third-party reference photography`}
        />
        <figcaption>
          Design inspiration only. This is not a completed SRIVARDHAN project or
          a client case study.
        </figcaption>
      </figure>
      <section className="scope section-pad">
        <div>
          <Kicker>IDEAS TO EXPLORE</Kicker>
          <h2>
            A starting point
            <br />
            <em>for your own story.</em>
          </h2>
          <p>
            Every project has a different context. These observations are a
            conversation starter for your space.
          </p>
        </div>
        <div>
          {i.details.map((d, n) => (
            <div className="scope-item" key={d}>
              <span>0{n + 1}</span>
              <p>{d}</p>
            </div>
          ))}
          <Button>Explore this direction</Button>
        </div>
      </section>
    </>
  );
}
function CaseStudy({ project: p }) {
  return (
    <>
      <PageIntro
        eyebrow={`${p.location} / ${p.scope}`}
        title={p.title}
        description={p.summary}
      />
      <figure className="wide-figure">
        <img src={asset(p.cover)} alt={p.title} />
      </figure>
      <article className="article-body">
        {p.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </section>
        ))}
      </article>
      <Consultation />
    </>
  );
}
function Article({ item: j }) {
  return (
    <>
      <PageIntro
        eyebrow={`${j.category.toUpperCase()} / THE JOURNAL`}
        title={j.title}
        description={j.intro}
      />
      <figure className="wide-figure">
        <Picture name={j.image} hero alt="Editorial reference photography" />
        <figcaption>Reference photography</figcaption>
      </figure>
      <article className="article-body">
        {j.paragraphs.map(([t, p]) => (
          <section key={t}>
            <h2>{t}</h2>
            <p>{p}</p>
          </section>
        ))}
        <a className="line-link" href={url("contact/")}>
          Bring your questions to a consultation <Arrow />
        </a>
      </article>
    </>
  );
}
function Legal({ privacy }) {
  return (
    <>
      <PageIntro
        eyebrow="A CLEAR UNDERSTANDING"
        title={privacy ? "Privacy & cookies." : "Website terms."}
      />
      <article className="article-body">
        {privacy ? (
          <>
            <h2>Your project inquiry</h2>
            <p>
              SRIVARDHAN INFRA & INTERIORS uses the name, contact number and
              project details you provide to respond to your inquiry and discuss
              your requested services. Contact consent is required; optional
              analytics and marketing consent are separate.
            </p>
            <h2>How your inquiry is delivered</h2>
            <p>
              When this site is connected to the lead service, inquiries are
              stored for authorised company staff to review. Where WhatsApp
              inquiry preparation is offered, your message is only sent when you
              open WhatsApp and press Send. WhatsApp, telephone and email
              services apply their own privacy terms.
            </p>
            <h2>Cookies and measurement</h2>
            <p>
              Essential browser storage remembers your privacy choices.
              Analytics and marketing tools, when configured, load only after
              your selection. Campaign parameters are included with a submitted
              inquiry only if you permit measurement. Names, telephone numbers
              and inquiry messages are not sent to browser analytics. If Meta
              server-side campaign measurement is configured and you permit
              marketing measurement, a one-way hash of your telephone number and
              the conversion reference may be shared with Meta to match and
              deduplicate the event. Change your choices using Cookie
              preferences in the footer. Optional measurement can include Google
              Analytics, Google Tag Manager, Google Ads and Meta Pixel.
            </p>
            <h2>Access and retention</h2>
            <p>
              Inquiries are accessible only to authorised staff through the lead
              service. You may request access, correction or deletion by
              emailing <a href={`mailto:${brand.email}`}>{brand.email}</a>. The
              business should retain inquiry information only as long as needed
              for the inquiry and any applicable obligations. Contact the team
              for the retention arrangements that apply to your project.
            </p>
            <h2>Your choices</h2>
            <p>
              You can use the site and contact the business without accepting
              optional tracking. Withdrawing contact consent does not undo
              processing already necessary to respond to your inquiry.
            </p>
          </>
        ) : (
          <>
            <h2>Information and proposals</h2>
            <p>
              This website introduces our services and design approach. It does
              not provide a binding quotation, guarantee, specification or
              construction agreement. Scope, responsibilities, fees, timing and
              exclusions are confirmed in a written agreement.
            </p>
            <h2>Images and project references</h2>
            <p>
              Images labelled design inspiration or reference photography
              illustrate design directions. They are not completed SRIVARDHAN
              projects. Published case studies, when available, will be
              separately identified with verified information.
            </p>
            <h2>Professional review</h2>
            <p>
              Editorial information is general design and planning guidance.
              Site conditions, structural work, approvals and technical
              decisions require assessment by the appropriate qualified
              professionals.
            </p>
            <h2>Third-party services</h2>
            <p>
              Links to Instagram, WhatsApp and other services are subject to
              those services’ terms. Availability and response times are not
              guaranteed by this website.
            </p>
            <h2>Get in touch</h2>
            <p>
              For questions about this website, email{" "}
              <a href={`mailto:${brand.email}`}>{brand.email}</a>.
            </p>
          </>
        )}
      </article>
    </>
  );
}
function AdminLoader() {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    import("./Admin.jsx")
      .then((m) => setComponent(() => m.default))
      .catch(() => setError(true));
  }, []);
  return Component ? (
    <Component PageIntro={PageIntro} Arrow={Arrow} />
  ) : (
    <PageIntro
      eyebrow="STAFF ACCESS"
      title={
        error
          ? "Please reload to open the lead desk."
          : "Opening the lead desk…"
      }
    />
  );
}

export default function App({ path = "" }) {
  const [cookies, setCookies] = useState(false);
  const home = path === "";
  const campaign = path.startsWith("consult/") && campaigns[path.split("/")[1]];
  const service = services.find((s) => path === `services/${s.slug}/`);
  const study = inspiration.find((i) => path === `inspiration/${i.slug}/`);
  const article = journal.find((j) => path === `journal/${j.slug}/`);
  const project = projects.find((p) => path === `projects/${p.slug}/`);
  useEffect(() => {
    initAnalytics();
    const configured =
      import.meta.env.VITE_GA4_ID ||
      import.meta.env.VITE_GTM_ID ||
      import.meta.env.VITE_META_PIXEL_ID ||
      import.meta.env.VITE_GOOGLE_ADS_ID;
    if (configured && !consent()) setCookies(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.07 },
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      el.classList.add("will-reveal");
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  let body;
  if (home)
    body = (
      <>
        <Hero />
        <div className="brand-strip">
          <span>INTERIORS</span>
          <i />
          ARCHITECTURE
          <i />
          CONSTRUCTION
          <span className="strip-end">
            A VISION, BEAUTIFULLY REALISED. <Arrow />
          </span>
        </div>
        <Philosophy />
        <Expertise />
        <Gallery />
        <Process />
        <Materials />
        <Confidence />
        <Consultation />
        <Journal />
      </>
    );
  else if (campaign)
    body = (
      <>
        <section className="campaign-hero">
          <Picture
            name={campaign.image}
            hero
            alt="Design reference photography"
          />
          <div>
            <Kicker light>{campaign.label}</Kicker>
            <h1>{campaign.title}</h1>
            <p>{campaign.intro}</p>
            <Button href="#consultation">Begin your consultation</Button>
            <span className="small-note">
              Design inspiration · reference photography
            </span>
          </div>
        </section>
        <section className="campaign-benefits section-pad">
          {campaign.benefits.map((b, i) => (
            <div key={b}>
              <span>0{i + 1}</span>
              <h3>{b}</h3>
            </div>
          ))}
        </section>
        <Consultation
          service={campaign.service}
          campaign={path.split("/")[1]}
        />
      </>
    );
  else if (service) body = <ServicePage service={service} />;
  else if (study) body = <InspirationPage item={study} />;
  else if (article) body = <Article item={article} />;
  else if (project) body = <CaseStudy project={project} />;
  else if (path === "services/")
    body = (
      <>
        <PageIntro
          eyebrow="INTERIORS / ARCHITECTURE / CONSTRUCTION"
          title={
            <>
              Possibilities,
              <br />
              <em>beautifully considered.</em>
            </>
          }
          description="A personal home. An ambitious workspace. A considered approach to each."
        />
        <Expertise all />
        <Consultation />
      </>
    );
  else if (path === "projects/")
    body = (
      <>
        <PageIntro
          eyebrow="OUR WORK & DESIGN PERSPECTIVE"
          title={
            <>
              Every space tells
              <br />
              <em>a different story.</em>
            </>
          }
          description="Explore design directions, then speak with us about the possibilities for your own space."
        />
        <Gallery full />
        <Consultation />
      </>
    );
  else if (path === "studio/")
    body = (
      <>
        <PageIntro
          eyebrow="THE STUDIO / VIJAYAWADA"
          title={
            <>
              Space is personal.
              <br />
              <em>So is our approach.</em>
            </>
          }
        />
        <Philosophy full />
        <Process />
        <Confidence />
        <Consultation />
      </>
    );
  else if (path === "contact/")
    body = (
      <>
        <PageIntro
          eyebrow="VIJAYAWADA / ANDHRA PRADESH"
          title={
            <>
              Your vision.
              <br />
              <em>Our next conversation.</em>
            </>
          }
        />
        <Consultation />
      </>
    );
  else if (path === "journal/")
    body = (
      <>
        <PageIntro
          eyebrow="DESIGN / MATERIALS / EVERYDAY LIFE"
          title={
            <>
              A considered
              <br />
              <em>point of view.</em>
            </>
          }
          description="Useful notes for the decisions that shape your space."
        />
        <Journal full />
      </>
    );
  else if (path === "privacy/" || path === "terms/")
    body = <Legal privacy={path === "privacy/"} />;
  else if (path === "admin/") body = <AdminLoader />;
  else
    body = (
      <>
        <PageIntro
          eyebrow="404 / A DIFFERENT DIRECTION"
          title="This space is still to be found."
          description="The page you’re looking for doesn’t exist. Let’s take you back to familiar ground."
        />
        <div className="section-pad">
          <Button href={url()}>Return home</Button>
        </div>
      </>
    );
  return (
    <div id="top">
      <Header home={home} campaign={!!campaign} />
      <main id="main" tabIndex={-1}>
        {body}
      </main>
      {campaign ? (
        <footer className="campaign-footer">
          <Logo />
          <a href={url("privacy/")}>Privacy</a>
          <a href={url("terms/")}>Terms</a>
          <button onClick={() => setCookies(true)}>Cookie preferences</button>
        </footer>
      ) : (
        <Footer onPrivacy={() => setCookies(true)} />
      )}
      <div className="mobile-contact">
        <a
          href={`https://wa.me/${brand.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track("whatsapp_click", { placement: "mobile_sticky" })
          }
        >
          WhatsApp <Arrow />
        </a>
        <a
          href={campaign ? "#consultation" : url("contact/")}
          onClick={() =>
            track("consultation_request", { placement: "mobile_sticky" })
          }
        >
          Private consultation <Arrow />
        </a>
      </div>
      <CookieSettings open={cookies} onClose={() => setCookies(false)} />
    </div>
  );
}
