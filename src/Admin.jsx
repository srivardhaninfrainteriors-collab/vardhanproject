import React, { useEffect, useRef, useState } from "react";
import { brand, asset, url, services } from "./content.js";
import "./crm.css";
const STAGES = [
  "new",
  "contacted",
  "qualified",
  "site visit",
  "proposal",
  "negotiation",
  "won",
  "lost",
];
const MONEY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
const money = (v) => MONEY.format((v || 0) / 100);
const date = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const time = (v) =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const title = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const initials = (s) =>
  (s || "?")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
function Icon({ name, ...props }) {
  const paths = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    leads: "M8 3h12v18H4V7z M8 3v4H4 M8 12h8 M8 16h5",
    pipeline: "M3 4h5v16H3z M10 4h5v11h-5z M17 4h4v7h-4z",
    tasks: "M8 3v4 M16 3v4 M3 9h18 M4 5h16v16H4z M8 14l3 3 5-6",
    reports: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
    team: "M15 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M16 3a4 4 0 0 1 0 7 M17 14a4 4 0 0 1 4 4v3",
    meta: "M3 17C-1 7 8 2 12 12s9 11 9 2S15 3 12 12 6 25 3 17",
    metaLeads: "M2 15c-1-6 5-9 8-3s7 7 7 1-4-7-7-1-4 9-8 3 M18 4l3 3 M21 4l-3 3",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6",
    plus: "M12 4v16 M4 12h16",
    arrow: "M5 12h14 M14 6l6 6-6 6",
    refresh: "M20 7V3l-3 3 M20 7a9 9 0 1 0 1 8 M20 7h-5",
    logout: "M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4",
    close: "M5 5l14 14 M5 19L19 5",
    check: "M4 12l5 5L20 6",
    download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4",
    menu: "M3 5h18 M3 12h18 M3 19h18",
    note: "M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h4",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.leads} />
    </svg>
  );
}
const Badge = ({ children, tone = "" }) => (
  <span className={`crm-badge ${tone}`}>{children}</span>
);
const Empty = ({ title: heading, children, action }) => (
  <div className="crm-empty">
    <Icon name="leads" width="32" height="32" />
    <h3>{heading}</h3>
    <p>{children}</p>
    {action}
  </div>
);
function Modal({ title: heading, onClose, children, wide = false }) {
  const dialog = useRef();
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={heading}
      className={`crm-modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
    >
      <div className="crm-modal-heading">
        <h2>{heading}</h2>
        <button
          className="crm-icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function LeadTable({ leads, onOpen, users, compact = false }) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th>Client / project</th>
            <th>Stage</th>
            <th>Source</th>
            {!compact && (
              <>
                <th>Owner</th>
                <th>Project value</th>
                <th>Received</th>
              </>
            )}
            <th>
              <span className="crm-sr">Open lead</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td>
                <button className="crm-client" onClick={() => onOpen(l.id)}>
                  <span className="crm-avatar">{initials(l.name)}</span>
                  <span>
                    <b>{l.name}</b>
                    <small>
                      {l.service || l.location || "Project details to discuss"}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <Badge tone={l.status}>{title(l.status)}</Badge>
              </td>
              <td>
                <span className="crm-source">
                  <i className={l.source} />
                  {l.source === "meta" ? "Meta Ads" : title(l.source)}
                </span>
                {l.attribution?.utm_source && (
                  <small className="crm-block crm-muted">
                    {title(l.attribution.utm_source)}
                    {l.attribution.utm_medium === "paid" ? " ad" : ""}
                    {l.attribution.utm_campaign
                      ? ` · ${l.attribution.utm_campaign}`
                      : ""}
                  </small>
                )}
              </td>
              {!compact && (
                <>
                  <td>
                    {l.owner_name ||
                      users.find((u) => u.id === l.owner_id)?.name || (
                        <span className="crm-muted">Unassigned</span>
                      )}
                  </td>
                  <td>{l.deal_value ? money(l.deal_value) : "—"}</td>
                  <td>{date(l.created_at)}</td>
                </>
              )}
              <td>
                <button
                  className="crm-icon-button"
                  aria-label={`Open ${l.name}`}
                  onClick={() => onOpen(l.id)}
                >
                  <Icon name="arrow" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Overview({ data, onOpen, setView, users }) {
  if (!data) return <p>Loading your workspace…</p>;
  const stats = [
    ["Total inquiries", data.total, "All active records", "leads"],
    [
      "Open opportunities",
      data.active,
      money(data.pipelineValue) + " in pipeline",
      "pipeline",
    ],
    [
      "Won project value",
      money(data.wonValue),
      "Based on recorded deal values",
      "reports",
    ],
    [
      "Overdue follow-ups",
      data.overdue,
      "A little attention goes a long way",
      "tasks",
    ],
  ];
  return (
    <>
      <div className="crm-metrics">
        {stats.map(([label, value, detail, icon]) => (
          <article key={label}>
            <div>
              <span>{label}</span>
              <Icon name={icon} />
            </div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      <div className="crm-overview-grid">
        <section className="crm-panel">
          <div className="crm-panel-heading">
            <div>
              <h2>Your sales pipeline</h2>
              <p>From a first conversation to a signed project.</p>
            </div>
            <button
              className="crm-text-button"
              onClick={() => setView("pipeline")}
            >
              View pipeline <Icon name="arrow" />
            </button>
          </div>
          <div className="crm-stage-chart">
            {data.stages.map((s) => (
              <div key={s.status}>
                <span>{title(s.status)}</span>
                <div>
                  <i
                    className={s.status}
                    style={{
                      width: `${data.total ? (s.count / data.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <b>{s.count}</b>
              </div>
            ))}
          </div>
          <div className="crm-panel-foot">
            <span>
              {data.newThisWeek} inquiries received in the last 7 days
            </span>
            <Badge tone="qualified">Live records</Badge>
          </div>
        </section>
        <section className="crm-panel crm-attention">
          <span className="crm-eyebrow">TODAY’S FOCUS</span>
          <div className="crm-attention-icon">
            <Icon name="tasks" width="30" height="30" />
          </div>
          <h2>
            {data.overdue
              ? `${data.overdue} follow-up${data.overdue === 1 ? " needs" : "s need"} your attention.`
              : "Make room for your next conversation."}
          </h2>
          <p>
            {data.overdue
              ? "Keep the momentum going. Review overdue calls, visits and proposal follow-ups."
              : "A timely follow-up turns a promising inquiry into a meaningful relationship."}
          </p>
          <button className="crm-primary" onClick={() => setView("tasks")}>
            Open follow-ups <Icon name="arrow" />
          </button>
          <div className="crm-attention-bottom">
            THOUGHTFUL RELATIONSHIPS. LASTING VALUE.
          </div>
        </section>
      </div>
      <section className="crm-panel">
        <div className="crm-panel-heading">
          <div>
            <h2>Recent inquiries</h2>
            <p>The newest conversations in your workspace.</p>
          </div>
          <button className="crm-text-button" onClick={() => setView("leads")}>
            All inquiries <Icon name="arrow" />
          </button>
        </div>
        {data.recent.length ? (
          <LeadTable leads={data.recent} users={users} onOpen={onOpen} />
        ) : (
          <Empty title="Your next project starts here">
            Website inquiries and connected Meta forms will appear here. You can
            also add a lead manually.
          </Empty>
        )}
      </section>
    </>
  );
}
function LeadForm({ users, onSave, onClose, manager }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Start a new conversation" onClose={onClose}>
      <form
        className="crm-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(Object.fromEntries(new FormData(e.currentTarget)));
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="crm-form-grid">
          <label>
            Client name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Phone number
            <input name="phone" type="tel" />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
          <label>
            Project location
            <input name="location" />
          </label>
          <label>
            Interested in
            <select name="service">
              <option value="">To be discussed</option>
              {services.map((s) => (
                <option key={s.slug}>{s.name}</option>
              ))}
            </select>
          </label>
          {manager && (
            <label>
              Assign to
              <select name="owner_id">
                <option value="">Unassigned</option>
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        <label>
          Project brief
          <textarea name="message" rows="3" maxLength={4000} />
        </label>
        <label>
          How did this person request contact?
          <input
            name="consentBasis"
            required
            maxLength={300}
            placeholder="e.g. Called the studio to request a consultation"
          />
        </label>
        <p className="crm-help">
          Add a phone number or email. This record does not grant advertising
          consent or send a message.
        </p>
        {error && (
          <p role="alert" className="crm-error">
            {error}
          </p>
        )}
        <button className="crm-primary" disabled={busy}>
          {busy ? "Saving…" : "Create lead"}
          <Icon name="plus" />
        </button>
      </form>
    </Modal>
  );
}
function ProposalForm({ onSave }) {
  const [items, setItems] = useState([
      { description: "", quantity: 1, price: 0 },
    ]),
    [tax, setTax] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const subtotal = items.reduce(
    (v, i) => v + Math.round(Number(i.quantity) * Number(i.price) * 100),
    0,
  );
  return (
    <form
      className="crm-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({
            ...Object.fromEntries(new FormData(e.currentTarget)),
            items,
            tax_rate: tax,
          });
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="crm-form-grid">
        <label>
          Proposal title
          <input
            name="title"
            required
            placeholder="Interior design & execution scope"
          />
        </label>
        <label>
          Valid until
          <input name="valid_until" type="date" required />
        </label>
      </div>
      <div className="crm-proposal-items">
        {items.map((item, index) => (
          <div key={index}>
            <label>
              Description
              <input
                value={item.description}
                required
                maxLength={250}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index ? { ...i, description: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            <label>
              Qty
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={item.quantity}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index ? { ...i, quantity: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            <label>
              Unit price (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={item.price}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index ? { ...i, price: e.target.value } : i,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="crm-icon-button"
              aria-label={`Remove item ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, n) => n !== index))}
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="crm-secondary"
        disabled={items.length >= 50}
        onClick={() =>
          setItems([...items, { description: "", quantity: 1, price: 0 }])
        }
      >
        Add line item
      </button>
      <div className="crm-form-grid">
        <label>
          Applicable tax (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </label>
        <div className="crm-quote-total">
          <small>PROPOSAL TOTAL</small>
          <strong>
            {money(subtotal + Math.round((subtotal * Number(tax)) / 100))}
          </strong>
        </div>
      </div>
      <label>
        Scope, exclusions & payment terms
        <textarea name="terms" rows="4" maxLength={4000} />
      </label>
      <p className="crm-help">
        A draft proposal, not an invoice. Confirm scope and applicable taxes
        before sharing.
      </p>
      {error && (
        <p role="alert" className="crm-error">
          {error}
        </p>
      )}
      <button className="crm-primary" disabled={busy}>
        {busy ? "Saving…" : "Save draft proposal"}
      </button>
    </form>
  );
}
function ProposalPreview({ proposal: p, lead, onClose }) {
  return (
    <Modal title={`Proposal ${p.number}`} onClose={onClose} wide>
      <article className="crm-print-proposal">
        <div className="crm-quote-brand">
          <img src={asset("logo.png")} alt="SRIVARDHAN logo" />
          <div>
            <b>SRIVARDHAN</b>
            <small>INFRA & INTERIORS</small>
          </div>
        </div>
        <span className="crm-eyebrow">PROJECT PROPOSAL · {p.number}</span>
        <h1>{p.title}</h1>
        <p>
          Prepared for <b>{lead.name}</b> ·{" "}
          {lead.location || "Location to be confirmed"}
        </p>
        <p>
          Created {date(p.created_at)} · Valid until {date(p.valid_until)} ·{" "}
          {title(p.status)}
        </p>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i, n) => (
              <tr key={n}>
                <td>{i.description}</td>
                <td>{i.quantity}</td>
                <td>{money(i.price * 100)}</td>
                <td>{money(Math.round(i.quantity * i.price * 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Tax: {p.tax_rate}%</p>
        <h2>Total {money(p.total)}</h2>
        <h3>Scope & terms</h3>
        <p className="crm-preserve">{p.terms || "To be agreed in writing."}</p>
        <p>
          {brand.phone} · {brand.email}
        </p>
        <p className="crm-help">
          This proposal is not a tax invoice. Final scope and contractual terms
          require written agreement.
        </p>
      </article>
      <button
        className="crm-primary crm-no-print"
        onClick={() => window.print()}
      >
        Print / save as PDF
      </button>
    </Modal>
  );
}
function LeadDetail({ id, request, users, user, onClose, onChanged }) {
  const [data, setData] = useState(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState(null),
    [newQuote, setNewQuote] = useState(false);
  const manager = user.role !== "agent";
  const load = async () => {
    const value = await request(`/leads/${id}`);
    setData(value);
  };
  useEffect(() => {
    let active = true;
    request(`/leads/${id}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const l = data?.lead;
  return (
    <Modal title={l?.name || "Opening inquiry…"} onClose={onClose} wide>
      {error && (
        <p className="crm-error" role="alert">
          {error}
          <button
            className="crm-text-button"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Refresh lead
          </button>
        </p>
      )}
      {l && (
        <>
          <div className="crm-detail-top">
            <div>
              <Badge tone={l.status}>{title(l.status)}</Badge>
              <Badge>
                {l.source === "meta" ? "Meta Lead Ads" : title(l.source)}
              </Badge>
              {l.archived === 1 && <Badge>Archived</Badge>}
              <p>
                {l.service || "Service to discuss"} ·{" "}
                {l.location || "Location to discuss"}
              </p>
            </div>
            <div className="crm-contact-actions">
              {l.phone && (
                <>
                  <a className="crm-secondary" href={`tel:${l.phone}`}>
                    Call
                  </a>
                  <a
                    className="crm-secondary"
                    href={`https://wa.me/${l.phone.replace(/\D/g, "").length === 10 ? "91" : ""}${l.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp ↗
                  </a>
                </>
              )}
              {l.email && (
                <a className="crm-secondary" href={`mailto:${l.email}`}>
                  Email
                </a>
              )}
            </div>
          </div>
          {data.duplicates.length > 0 && (
            <div className="crm-notice">
              Possible matching contacts:{" "}
              {data.duplicates.map((d) => d.name).join(", ")}. Records are kept
              separate so project inquiries are not lost.
            </div>
          )}
          <div className="crm-tabs" role="tablist" aria-label="Lead details">
            {[
              "overview",
              "activity",
              "follow-ups",
              "proposals",
              "attribution",
            ].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={t === tab}
                onClick={() => setTab(t)}
              >
                {title(t)}
                {t === "follow-ups"
                  ? ` (${data.tasks.filter((t) => !t.completed_at).length})`
                  : ""}
              </button>
            ))}
          </div>
          <div className="crm-detail-content">
            {tab === "overview" && (
              <form
                className="crm-form"
                key={l.version}
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  input.version = l.version;
                  input.deal_value = Math.round(Number(input.deal_value) * 100);
                  action(() =>
                    request(`/leads/${id}`, { method: "PATCH", body: input }),
                  );
                }}
              >
                <fieldset disabled={busy}>
                  <div className="crm-form-grid">
                    <label>
                      Client name
                      <input name="name" defaultValue={l.name} required />
                    </label>
                    <label>
                      Stage
                      <select name="status" defaultValue={l.status}>
                        {STAGES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Phone
                      <input name="phone" defaultValue={l.phone} />
                    </label>
                    <label>
                      Email
                      <input name="email" type="email" defaultValue={l.email} />
                    </label>
                    <label>
                      Service
                      <select name="service" defaultValue={l.service || ""}>
                        <option value="">To discuss</option>
                        {l.service &&
                          !services.some((s) => s.name === l.service) && (
                            <option>{l.service}</option>
                          )}
                        {services.map((s) => (
                          <option key={s.slug}>{s.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Location
                      <input name="location" defaultValue={l.location} />
                    </label>
                    <label>
                      Property type
                      <input name="property" defaultValue={l.property} />
                    </label>
                    <label>
                      Area (sq ft)
                      <input name="area" defaultValue={l.area} />
                    </label>
                    <label>
                      Indicative budget
                      <input name="budget" defaultValue={l.budget} />
                    </label>
                    <label>
                      Timeline
                      <input name="timeline" defaultValue={l.timeline} />
                    </label>
                    <label>
                      Estimated deal value (₹)
                      <input
                        name="deal_value"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={l.deal_value / 100}
                      />
                    </label>
                    <label>
                      Expected close date
                      <input
                        name="expected_close"
                        type="date"
                        defaultValue={l.expected_close}
                      />
                    </label>
                    <label>
                      Priority
                      <select name="priority" defaultValue={l.priority}>
                        {["normal", "high", "urgent"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    {manager && (
                      <label>
                        Owner
                        <select name="owner_id" defaultValue={l.owner_id || ""}>
                          <option value="">Unassigned</option>
                          {users
                            .filter((u) => u.active || u.id === l.owner_id)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                                {!u.active ? " (inactive)" : ""}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Organisation
                      <input name="company" defaultValue={l.company} />
                    </label>
                    <label>
                      Tags
                      <input
                        name="tags"
                        defaultValue={l.tags}
                        placeholder="Villa, warm lead, referral"
                      />
                    </label>
                  </div>
                  <label>
                    Project brief
                    <textarea
                      name="message"
                      rows="3"
                      defaultValue={l.message}
                    />
                  </label>
                  <label>
                    Contact permission / source
                    <input
                      name="consentBasis"
                      defaultValue={
                        l.consentBasis ||
                        (l.consent
                          ? "Website contact consent recorded"
                          : "To be verified")
                      }
                    />
                  </label>
                  <label>
                    Reason if lost
                    <textarea
                      name="lostReason"
                      rows="2"
                      defaultValue={l.lostReason}
                    />
                  </label>
                  <div className="crm-form-footer">
                    <button className="crm-primary">
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                    {manager && (
                      <button
                        className="crm-secondary"
                        type="button"
                        onClick={() =>
                          action(() =>
                            request(`/leads/${id}`, {
                              method: "PATCH",
                              body: {
                                version: l.version,
                                archived: !l.archived,
                              },
                            }),
                          )
                        }
                      >
                        {l.archived ? "Restore lead" : "Archive lead"}
                      </button>
                    )}
                  </div>
                </fieldset>
              </form>
            )}
            {tab === "activity" && (
              <>
                <form
                  className="crm-form crm-note-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      input = Object.fromEntries(new FormData(form));
                    action(async () => {
                      await request(`/leads/${id}/notes`, {
                        method: "POST",
                        body: input,
                      });
                      form.reset();
                    });
                  }}
                >
                  <label>
                    Log a note or conversation
                    <select name="kind">
                      {["note", "call", "meeting", "email", "whatsapp"].map(
                        (t) => (
                          <option key={t}>{t}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <textarea
                    name="body"
                    rows="3"
                    maxLength={4000}
                    required
                    placeholder="What was discussed? What happens next?"
                  />
                  <p className="crm-help">
                    This logs an activity only. It does not send an email or
                    message.
                  </p>
                  <button className="crm-primary" disabled={busy}>
                    Add to timeline
                  </button>
                </form>
                <div className="crm-timeline">
                  {data.activity.map((a) => (
                    <article key={a.id}>
                      <i />
                      <div>
                        <small>
                          {title(a.kind)} · {a.actor_name || "System"} ·{" "}
                          {time(a.created_at)}
                        </small>
                        <p>{a.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "follow-ups" && (
              <>
                <form
                  className="crm-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      input = Object.fromEntries(new FormData(form));
                    input.due_at = new Date(input.due_at).toISOString();
                    action(async () => {
                      await request(`/leads/${id}/tasks`, {
                        method: "POST",
                        body: input,
                      });
                      form.reset();
                    });
                  }}
                >
                  <label>
                    Follow-up title
                    <input
                      name="title"
                      required
                      placeholder="Discuss material palette and project budget"
                    />
                  </label>
                  <div className="crm-form-grid">
                    <label>
                      When
                      <input name="due_at" type="datetime-local" required />
                    </label>
                    <label>
                      Type
                      <select name="kind">
                        {[
                          "follow-up",
                          "call",
                          "site visit",
                          "proposal",
                          "meeting",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    {manager && (
                      <label>
                        Assign to
                        <select
                          name="owner_id"
                          defaultValue={l.owner_id || user.id}
                        >
                          {users
                            .filter(
                              (u) =>
                                u.active &&
                                (u.role !== "agent" || u.id === l.owner_id),
                            )
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <button className="crm-primary" disabled={busy}>
                    Schedule follow-up
                  </button>
                </form>
                <TaskList
                  tasks={data.tasks}
                  onEdit={async (taskId, input) => {
                    await request(`/tasks/${taskId}`, {
                      method: "PATCH",
                      body: input,
                    });
                    await load();
                    onChanged();
                  }}
                  onToggle={(t) =>
                    action(() =>
                      request(`/tasks/${t.id}`, {
                        method: "PATCH",
                        body: { completed: !t.completed_at },
                      }),
                    )
                  }
                />
              </>
            )}
            {tab === "proposals" && (
              <>
                {newQuote ? (
                  <ProposalForm
                    onSave={async (input) => {
                      await request(`/leads/${id}/proposals`, {
                        method: "POST",
                        body: input,
                      });
                      setNewQuote(false);
                      await load();
                      onChanged();
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="crm-primary"
                      onClick={() => setNewQuote(true)}
                    >
                      Create proposal <Icon name="plus" />
                    </button>
                    {!data.proposals.length && (
                      <Empty title="A clear scope starts here">
                        Create a line-item proposal, review it, and print or
                        save it as a PDF to share personally.
                      </Empty>
                    )}
                    {data.proposals.map((p) => (
                      <article className="crm-proposal-card" key={p.id}>
                        <div>
                          <small>
                            {p.number} · Valid until {date(p.valid_until)}
                          </small>
                          <h3>{p.title}</h3>
                          <strong>{money(p.total)}</strong>
                        </div>
                        <div>
                          <select
                            aria-label={`Status of ${p.number}`}
                            value={p.status}
                            disabled={busy}
                            onChange={(e) =>
                              action(() =>
                                request(`/proposals/${p.id}`, {
                                  method: "PATCH",
                                  body: { status: e.target.value },
                                }),
                              )
                            }
                          >
                            {["draft", "sent", "accepted", "declined"].map(
                              (s) => (
                                <option key={s}>{s}</option>
                              ),
                            )}
                          </select>
                          <button
                            className="crm-secondary"
                            onClick={() => setQuote(p)}
                          >
                            Preview / print
                          </button>
                        </div>
                      </article>
                    ))}
                    <p className="crm-help">
                      “Sent” and “accepted” are staff-recorded states. The CRM
                      does not send or sign proposals automatically.
                    </p>
                  </>
                )}
              </>
            )}
            {tab === "attribution" && (
              <div className="crm-attribution">
                <h3>Where this conversation began</h3>
                <dl>
                  <dt>Source</dt>
                  <dd>{l.source}</dd>
                  <dt>Received</dt>
                  <dd>{time(l.created_at)}</dd>
                  <dt>Contact consent</dt>
                  <dd>
                    {l.consent
                      ? "Website consent recorded"
                      : l.consentBasis || "Verify before outreach"}
                  </dd>
                  <dt>Advertising consent</dt>
                  <dd>
                    {l.marketingConsent
                      ? "Recorded"
                      : "Not granted / not recorded"}
                  </dd>
                  {Object.entries(l.attribution || {}).map(([k, v]) => (
                    <React.Fragment key={k}>
                      <dt>{k.replaceAll("_", " ")}</dt>
                      <dd>{String(v)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                {l.meta && (
                  <>
                    <h3>Original Meta form answers</h3>
                    <dl>
                      {Object.entries(l.meta.answers || {}).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt>{k}</dt>
                          <dd>{String(v)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                    {l.meta.custom_disclaimer_responses?.length > 0 && (
                      <>
                        <h3>Form consent responses</h3>
                        <pre className="crm-consent-response">
                          {JSON.stringify(
                            l.meta.custom_disclaimer_responses,
                            null,
                            2,
                          )}
                        </pre>
                      </>
                    )}
                    <p className="crm-help">
                      Meta lead ID: {l.meta.leadgen_id}. The original answers
                      are retained even when CRM fields are edited.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          {quote && (
            <ProposalPreview
              proposal={quote}
              lead={l}
              onClose={() => setQuote(null)}
            />
          )}
        </>
      )}
    </Modal>
  );
}
function TaskList({ tasks, onToggle, onOpen, onEdit }) {
  const [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const localTime = (value) => {
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <div className="crm-task-list">
      {tasks.length === 0 ? (
        <Empty title="A clear calendar">
          Add a follow-up from a lead’s detail view.
        </Empty>
      ) : (
        tasks.map((t) => (
          <article key={t.id} className={t.completed_at ? "done" : ""}>
            <button
              aria-label={`${t.completed_at ? "Reopen" : "Complete"} ${t.title}`}
              className="crm-task-check"
              onClick={() => onToggle(t)}
            >
              {t.completed_at && <Icon name="check" />}
            </button>
            <div>
              <b>{t.title}</b>
              {onOpen && (
                <button
                  className="crm-task-lead"
                  onClick={() => onOpen(t.lead_id)}
                >
                  {t.lead_name}
                </button>
              )}
              <small>
                {title(t.kind)} · {t.owner_name || "Unassigned"}
              </small>
            </div>
            <span
              className={
                !t.completed_at && new Date(t.due_at) < new Date()
                  ? "crm-overdue"
                  : ""
              }
            >
              {time(t.due_at)}
            </span>
            {onEdit && (
              <button
                className="crm-text-button"
                onClick={() => {
                  setError("");
                  setEditing(t);
                }}
                aria-label={`Edit ${t.title}`}
              >
                Edit
              </button>
            )}
          </article>
        ))
      )}
      {editing && (
        <Modal title="Edit follow-up" onClose={() => setEditing(null)}>
          <form
            className="crm-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              const input = Object.fromEntries(new FormData(e.currentTarget));
              input.due_at = new Date(input.due_at).toISOString();
              try {
                await onEdit(editing.id, input);
                setEditing(null);
              } catch (e) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              Follow-up title
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editing.title}
              />
            </label>
            <label>
              When
              <input
                name="due_at"
                type="datetime-local"
                required
                defaultValue={localTime(editing.due_at)}
              />
            </label>
            <label>
              Type
              <select name="kind" defaultValue={editing.kind}>
                {["follow-up", "call", "site visit", "proposal", "meeting"].map(
                  (k) => (
                    <option key={k}>{k}</option>
                  ),
                )}
              </select>
            </label>
            {error && (
              <p role="alert" className="crm-error">
                {error}
              </p>
            )}
            <button className="crm-primary" disabled={saving}>
              Save follow-up
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
const ago = (v) => {
  if (!v) return "—";
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  return date(v);
};
const digits = (p) => String(p || "").replace(/\D/g, "");
const whatsapp = (p) => {
  const d = digits(p);
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : "";
};
const pretty = (k) =>
  String(k)
    .replace(/[_?]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
function MetaLeads({ request, user, users, onOpen, refreshKey, endpoint, onError, setView }) {
  const [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [status, setStatus] = useState(null),
    [q, setQ] = useState(""),
    [stage, setStage] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [note, setNote] = useState(""),
    [expanded, setExpanded] = useState(null);
  const admin = user.role === "admin";
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const t = setTimeout(
      async () => {
        try {
          const params = new URLSearchParams({ source: "meta", q, status: stage, offset: String(offset) });
          const [list, meta] = await Promise.all([
            request(`/leads?${params}`, { signal: controller.signal }),
            admin ? request("/meta", { signal: controller.signal }).catch(() => null) : Promise.resolve(null),
          ]);
          if (!active) return;
          setRows(list.leads);
          setTotal(list.total);
          if (meta) setStatus(meta);
          setLoaded(true);
        } catch (e) {
          if (active && e.name !== "AbortError") onError(e.message);
        }
      },
      q ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(t);
      controller.abort();
    };
  }, [q, stage, offset, refreshKey]);
  async function sync() {
    setBusy(true);
    setNote("");
    try {
      const r = await request("/meta/sync", { method: "POST", body: {} });
      setNote(r.note);
      setOffset(0);
      const list = await request(`/leads?${new URLSearchParams({ source: "meta", q, status: stage })}`);
      setRows(list.leads);
      setTotal(list.total);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = rows.filter((l) => new Date(l.created_at) >= dayStart).length,
    week = rows.filter((l) => Date.now() - new Date(l.created_at) < 7 * 864e5).length,
    fresh = rows.filter((l) => l.status === "new").length;
  const connected = status?.configured;
  return (
    <>
      <section className="crm-panel crm-meta-banner crm-meta-live">
        <div className="crm-meta-symbol">
          <Icon name="meta" width="48" height="48" />
        </div>
        <div>
          <span className="crm-eyebrow">FACEBOOK & INSTAGRAM INSTANT FORMS</span>
          <h2>Meta Ads Leads</h2>
          <p>
            {admin
              ? connected
                ? `Live from ${status.connection.pageName || "your Facebook Page"}. New form submissions appear here within seconds.`
                : status
                  ? "Facebook is not connected yet. Connect your Page once and every new lead will flow in automatically."
                  : "Checking your Facebook connection…"
              : "Every lead from your Facebook and Instagram ads, ready for a quick first call."}
          </p>
        </div>
        <div className="crm-meta-actions">
          {admin && status && (
            <Badge tone={connected ? "won" : "new"}>
              {connected ? "● Live" : "Not connected"}
            </Badge>
          )}
          {admin && connected && (
            <button className="crm-secondary" disabled={busy} onClick={sync}>
              <Icon name="refresh" /> {busy ? "Syncing…" : "Sync now"}
            </button>
          )}
          {admin && status && !connected && (
            <a className="crm-primary" href={`${endpoint}/crm/meta/connect`}>
              Connect Facebook <Icon name="arrow" />
            </a>
          )}
          {admin && (
            <button className="crm-text-button" onClick={() => setView("meta")}>
              Meta setup →
            </button>
          )}
        </div>
      </section>
      {note && (
        <p className="crm-notice" role="status">
          {note}
        </p>
      )}
      <div className="crm-metrics">
        {[
          ["Meta leads", total, "All active Meta records", "metaLeads"],
          ["Today", today, "Received since midnight", "tasks"],
          ["Last 7 days", week, "Recent ad responses", "reports"],
          ["Awaiting first call", fresh, "Still in the New stage", "leads"],
        ].map(([label, value, detail, icon]) => (
          <article key={label}>
            <div>
              <span>{label}</span>
              <Icon name={icon} />
            </div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      <div className="crm-filters">
        <label className="crm-search">
          <Icon name="search" />
          <input
            aria-label="Search Meta leads"
            placeholder="Search name, phone, email or city"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <select
          aria-label="Filter stage"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {title(s)}
            </option>
          ))}
        </select>
      </div>
      <section className="crm-panel">
        {rows.length ? (
          <div className="crm-meta-leads">
            {rows.map((l) => {
              const m = l.meta || {};
              const isNew = Date.now() - new Date(l.created_at) < 864e5;
              const extra = Object.entries(m.answers || {}).filter(
                ([k]) => !["full_name", "phone_number", "email", "city", "first_name", "last_name"].includes(k),
              );
              return (
                <article key={l.id} className={isNew ? "fresh" : ""}>
                  <button className="crm-client" onClick={() => onOpen(l.id)}>
                    <span className="crm-avatar">{initials(l.name)}</span>
                    <span>
                      <b>
                        {l.name}
                        {isNew && <em className="crm-new-pill">NEW</em>}
                      </b>
                      <small>
                        {[l.location, l.service].filter(Boolean).join(" · ") || "Details in form answers"}
                      </small>
                    </span>
                  </button>
                  <div className="crm-meta-contact">
                    {l.phone && <a href={`tel:${digits(l.phone)}`}>{l.phone}</a>}
                    {l.email && <a href={`mailto:${l.email}`}>{l.email}</a>}
                  </div>
                  <div className="crm-meta-source">
                    <b>{m.form_name || "Instant Form"}</b>
                    <small>
                      {[m.campaign_name, m.ad_name].filter(Boolean).join(" · ") ||
                        (m.ad_id ? `Ad ${m.ad_id}` : m.is_organic ? "Organic" : "Meta Ads")}
                      {m.platform ? ` · ${m.platform === "ig" ? "Instagram" : m.platform === "fb" ? "Facebook" : m.platform}` : ""}
                    </small>
                  </div>
                  <div className="crm-meta-state">
                    <Badge tone={l.status}>{title(l.status)}</Badge>
                    <small title={time(l.created_at)}>{ago(l.created_at)}</small>
                  </div>
                  <div className="crm-meta-buttons">
                    {l.phone && (
                      <a className="crm-icon-button" href={`tel:${digits(l.phone)}`} aria-label={`Call ${l.name}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2" />
                        </svg>
                      </a>
                    )}
                    {whatsapp(l.phone) && (
                      <a
                        className="crm-icon-button"
                        href={whatsapp(l.phone)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`WhatsApp ${l.name}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z" />
                        </svg>
                      </a>
                    )}
                    {extra.length > 0 && (
                      <button
                        className="crm-secondary"
                        aria-expanded={expanded === l.id}
                        onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                      >
                        Answers
                      </button>
                    )}
                    <button className="crm-icon-button" aria-label={`Open ${l.name}`} onClick={() => onOpen(l.id)}>
                      <Icon name="arrow" />
                    </button>
                  </div>
                  {expanded === l.id && (
                    <dl className="crm-meta-answers">
                      {extra.map(([k, v]) => (
                        <div key={k}>
                          <dt>{pretty(k)}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty title={loaded ? (q || stage ? "No Meta leads match." : "No Meta leads yet.") : "Loading Meta leads…"}>
            {loaded && !q && !stage
              ? admin && status && !connected
                ? "Connect Facebook to start receiving Instant Form leads here."
                : "As soon as someone submits your Facebook or Instagram lead form, they’ll appear here."
              : "Try another search or stage."}
          </Empty>
        )}
      </section>
      <div className="crm-pagination">
        <span>{total ? `${offset + 1}–${offset + rows.length} of ${total} Meta leads` : "0 Meta leads"}</span>
        <div>
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>
            ← Previous
          </button>
          <button disabled={offset + rows.length >= total} onClick={() => setOffset(offset + 100)}>
            Next →
          </button>
        </div>
      </div>
    </>
  );
}
function MetaSettings({ data, request, users, onRefresh, onError, endpoint }) {
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [localError, setLocalError] = useState("");
  if (!data) return <p>Loading integration settings…</p>;
  async function run(fn) {
    setBusy(true);
    setLocalError("");
    try {
      const response = await fn();
      setNotice(
        response.note ||
          "Operation completed. Refresh import diagnostics to check progress.",
      );
      onRefresh();
    } catch (e) {
      setLocalError(e.message);
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="crm-panel crm-meta-banner">
        <div className="crm-meta-symbol">
          <Icon name="meta" width="48" height="48" />
        </div>
        <div>
          <span className="crm-eyebrow">CONNECTED LEAD SOURCES</span>
          <h2>Meta Lead Ads</h2>
          <p>
            Bring Facebook and Instagram Instant Form inquiries into one
            considered workflow.
          </p>
        </div>
        <Badge tone={data.configured ? "won" : "new"}>
          {data.configured ? "● Connected" : "Setup required"}
        </Badge>
      </section>
      <div className="crm-overview-grid">
        <section className="crm-panel">
          <div className="crm-panel-heading">
            <div>
              <h2>Facebook connection</h2>
              <p>One click links your Page. Tokens are encrypted on the server.</p>
            </div>
          </div>
          <div className="crm-checklist">
            {[
              ["Meta app", data.flags.appId && data.flags.appSecret],
              [
                data.connection.pageName
                  ? `Facebook Page · ${data.connection.pageName}`
                  : "Facebook Page",
                data.flags.pageConnected,
              ],
              ["Lead webhook", data.flags.webhook],
              ["Instant Forms", data.forms.length > 0],
            ].map(([label, ok]) => (
              <div key={label}>
                <span>{label}</span>
                <Badge tone={ok ? "qualified" : "new"}>{ok ? "Ready" : "Pending"}</Badge>
              </div>
            ))}
          </div>
          {data.pendingPages.length > 0 && (
            <div className="crm-page-picker">
              <h3>Choose the Page that runs your lead ads</h3>
              {data.pendingPages.map((p) => (
                <button
                  key={p.id}
                  className="crm-secondary"
                  disabled={busy}
                  onClick={() =>
                    run(() => request("/meta/select-page", { method: "POST", body: { page_id: p.id } }))
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="crm-panel-actions">
            {!data.flags.pageConnected ? (
              <a
                className={`crm-primary ${data.flags.appId && data.flags.appSecret ? "" : "disabled"}`}
                href={data.flags.appId && data.flags.appSecret ? `${endpoint}/crm/meta/connect` : undefined}
                aria-disabled={!(data.flags.appId && data.flags.appSecret)}
              >
                Connect Facebook <Icon name="arrow" />
              </a>
            ) : (
              <>
                <button
                  className="crm-primary"
                  disabled={busy}
                  onClick={() => run(() => request("/meta/sync", { method: "POST", body: { rewire: true } }))}
                >
                  Re-check & sync
                </button>
                <a className="crm-secondary" href={`${endpoint}/crm/meta/connect`}>
                  Reconnect
                </a>
                <button
                  className="crm-text-button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Disconnect Facebook? Existing leads stay in the CRM."))
                      run(() => request("/meta/disconnect", { method: "POST", body: {} }));
                  }}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </section>
        <section className="crm-panel crm-setup-notes">
          <h2>Delivery health</h2>
          <p>
            Connected by: {data.connection.connectedBy || "—"} · {time(data.connection.connectedAt)}
            <br />
            Webhook registered: {time(data.state.webhook_registered_at)}
            <br />
            Webhook verified by Meta: {time(data.state.verified_at)}
            <br />
            Last webhook: {time(data.state.last_webhook)}
            <br />
            Last imported lead: {time(data.state.last_import)}
            <br />
            Graph API: {data.graphVersion}
          </p>
          <p className="crm-help">
            Webhook URL: <code>{data.webhookUrl}</code>
            <br />
            OAuth redirect: <code>{data.redirectUrl}</code>
          </p>
          {data.state.connect_error && !data.flags.pageConnected && (
            <p className="crm-error">Last connect error: {data.state.connect_error}</p>
          )}
          <p className="crm-help">
            New forms are detected and mapped automatically. Use Meta’s Lead Ads Testing Tool to send a
            test lead and confirm it appears under Meta Ads Leads.
          </p>
        </section>
      </div>
      {notice && (
        <p className="crm-notice" role="status">
          {notice}
        </p>
      )}
      <section className="crm-panel">
        <div className="crm-panel-heading">
          <div>
            <h2>Instant Forms & routing</h2>
            <p>
              Match your question names to CRM fields and choose a lead owner.
            </p>
          </div>
          <button
            className="crm-primary"
            onClick={() =>
              setEditing({
                mapping: data.defaultMapping,
                defaults: {},
                enabled: 1,
              })
            }
          >
            Add form <Icon name="plus" />
          </button>
        </div>
        {data.forms.length ? (
          <div className="crm-form-cards">
            {data.forms.map((f) => (
              <article key={f.form_id}>
                <div>
                  <Badge tone={f.enabled ? "qualified" : "lost"}>
                    {f.enabled ? "Enabled" : "Paused"}
                  </Badge>
                  <h3>{f.label}</h3>
                  <p>
                    Form {f.form_id} ·{" "}
                    {users.find((u) => u.id === f.owner_id)?.name ||
                      "Unassigned"}
                  </p>
                </div>
                <div className="crm-form-footer">
                  <button
                    className="crm-secondary"
                    onClick={() => setEditing(f)}
                  >
                    Edit mapping
                  </button>
                  <button
                    className="crm-secondary"
                    disabled={!data.configured || !f.enabled || busy}
                    onClick={() =>
                      run(() =>
                        request("/meta/backfill", {
                          method: "POST",
                          body: {
                            form_id: f.form_id,
                            restart: !!f.backfill_complete,
                          },
                        }),
                      )
                    }
                  >
                    {f.backfill_complete
                      ? "Restart historical import"
                      : f.backfill_cursor
                        ? "Import next 100"
                        : "Import up to 100 recent leads"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No Instant Forms yet">
            Forms on your connected Page are added automatically, including
            new ones the first time they receive a lead.
          </Empty>
        )}
      </section>
      <section className="crm-panel">
        <div className="crm-panel-heading">
          <div>
            <h2>Import diagnostics</h2>
            <p>
              Signed deliveries are stored before processing. Duplicate Meta
              lead IDs are ignored.
            </p>
          </div>
          <button className="crm-secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        {!data.jobs.length ? (
          <Empty title="Waiting for the first delivery">
            Your recent webhook jobs and retrieval results will appear here.
          </Empty>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Meta lead / form</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Details</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.leadgen_id}>
                    <td>
                      {j.leadgen_id}
                      <small className="crm-block">Form {j.form_id}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          j.status === "imported"
                            ? "won"
                            : j.status === "failed"
                              ? "lost"
                              : "new"
                        }
                      >
                        {j.status}
                      </Badge>
                    </td>
                    <td>{j.attempts}</td>
                    <td className="crm-diagnostic">
                      {j.last_error || time(j.updated_at)}
                    </td>
                    <td>
                      {["failed", "retry"].includes(j.status) && (
                        <button
                          className="crm-secondary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              request("/meta/retry", {
                                method: "POST",
                                body: { leadgen_id: j.leadgen_id },
                              }),
                            )
                          }
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <Modal title="Meta form mapping" onClose={() => setEditing(null)} wide>
          <form
            className="crm-form"
            onSubmit={(e) => {
              e.preventDefault();
              const input = Object.fromEntries(new FormData(e.currentTarget)),
                mapping = {},
                defaults = {};
              Object.keys(data.defaultMapping).forEach(
                (k) => (mapping[k] = input[`map_${k}`]),
              );
              ["service", "location", "property"].forEach(
                (k) => (defaults[k] = input[`default_${k}`]),
              );
              run(async () => {
                await request("/meta/forms", {
                  method: "POST",
                  body: {
                    ...input,
                    mapping,
                    defaults,
                    enabled: input.enabled === "on",
                  },
                });
                setEditing(null);
                return {};
              });
            }}
          >
            <div className="crm-form-grid">
              <label>
                Meta form ID
                <input
                  name="form_id"
                  required
                  pattern="[0-9]+"
                  defaultValue={editing.form_id}
                  readOnly={!!editing.form_id}
                />
              </label>
              <label>
                Form name
                <input
                  name="label"
                  required
                  defaultValue={editing.label}
                  placeholder="Vijayawada villa consultations"
                />
              </label>
              <label>
                Lead owner
                <select name="owner_id" defaultValue={editing.owner_id || ""}>
                  <option value="">Unassigned</option>
                  {users
                    .filter((u) => u.active)
                    .map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="crm-checkbox">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={!!editing.enabled}
                />{" "}
                Enable imports
              </label>
            </div>
            {localError && (
              <p role="alert" className="crm-error">
                {localError}
              </p>
            )}
            <h3>Question field names</h3>
            <p className="crm-help">
              Use the exact field name Meta returns, not the display label.
              Unmapped answers are preserved in the lead’s attribution tab.
            </p>
            <div className="crm-form-grid">
              {Object.keys(data.defaultMapping).map((k) => (
                <label key={k}>
                  {title(k)}
                  <input name={`map_${k}`} defaultValue={editing.mapping[k]} />
                </label>
              ))}
            </div>
            <h3>Defaults when an answer is missing</h3>
            <div className="crm-form-grid">
              {["service", "location", "property"].map((k) => (
                <label key={k}>
                  {title(k)}
                  <input
                    name={`default_${k}`}
                    defaultValue={editing.defaults[k]}
                  />
                </label>
              ))}
            </div>
            <button className="crm-primary" disabled={busy}>
              Save mapping
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Team({ users, request, onRefresh, onError }) {
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState("");
  async function update(id, input) {
    setBusy(true);
    try {
      await request(`/team/${id}`, { method: "PATCH", body: input });
      onRefresh();
    } catch (e) {
      setLocalError(e.message);
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="crm-panel">
      <div className="crm-panel-heading">
        <div>
          <h2>A team, in sync.</h2>
          <p>
            Admins manage access and integrations. Managers see all leads.
            Agents see their assigned leads.
          </p>
        </div>
        <button className="crm-primary" onClick={() => setAdding(true)}>
          Add teammate <Icon name="plus" />
        </button>
      </div>
      <div className="crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Team member</th>
              <th>Role</th>
              <th>Status</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="crm-client">
                    <span className="crm-avatar">{initials(u.name)}</span>
                    <span>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`Role for ${u.name}`}
                    value={u.role}
                    disabled={busy}
                    onChange={(e) => update(u.id, { role: e.target.value })}
                  >
                    {["admin", "manager", "agent"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <Badge tone={u.active ? "qualified" : "lost"}>
                    {u.active ? "Active" : "Disabled"}
                  </Badge>
                </td>
                <td>
                  <button
                    className="crm-secondary"
                    disabled={busy}
                    onClick={() => update(u.id, { active: !u.active })}
                  >
                    {u.active ? "Disable access" : "Enable access"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <Modal
          title="Invite a teammate to the workspace"
          onClose={() => setAdding(false)}
        >
          <form
            className="crm-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await request("/team", {
                  method: "POST",
                  body: Object.fromEntries(new FormData(e.currentTarget)),
                });
                setAdding(false);
                onRefresh();
              } catch (e) {
                setLocalError(e.message);
                onError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {localError && (
              <p role="alert" className="crm-error">
                {localError}
              </p>
            )}
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Email / sign-in ID
              <input name="email" type="email" required />
            </label>
            <label>
              Initial password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Role
              <select name="role">
                <option>agent</option>
                <option>manager</option>
                <option>admin</option>
              </select>
            </label>
            <p className="crm-help">
              No invitation email is sent. Share access through your approved
              secure channel. Teammates can change their password in Settings.
            </p>
            <button className="crm-primary" disabled={busy}>
              Create team account
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
export default function Admin() {
  const [session, setSession] = useState(null),
    [checking, setChecking] = useState(true),
    [view, setView] = useState("overview"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [data, setData] = useState(null),
    [users, setUsers] = useState([]),
    [leads, setLeads] = useState([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [tasks, setTasks] = useState([]),
    [meta, setMeta] = useState(null),
    [query, setQuery] = useState(""),
    [filters, setFilters] = useState({
      status: "",
      source: "",
      owner_id: "",
      priority: "",
      archived: "",
    }),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState(null),
    [adding, setAdding] = useState(false),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const drawer = useRef(null),
    menuButton = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const focusable = () =>
      [
        ...drawer.current.querySelectorAll("a[href], button:not([disabled])"),
      ].filter((el) => el.getClientRects().length);
    focusable()[0]?.focus();
    const keydown = (e) => {
      if (!window.matchMedia("(max-width: 950px)").matches) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false);
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      menuButton.current?.focus();
    };
  }, [menu]);
  const endpoint = (import.meta.env.VITE_CRM_API_URL || "/api").replace(
    /\/$/,
    "",
  );
  function clearWorkspace() {
    setData(null);
    setUsers([]);
    setLeads([]);
    setTasks([]);
    setMeta(null);
    setTotal(0);
    setSelected(null);
    setAdding(false);
    setLoaded(false);
    setView("overview");
    setQuery("");
    setOffset(0);
  }
  async function request(path, options = {}) {
    const res = await fetch(`${endpoint}/crm${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
        ...options.headers,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    let value;
    try {
      value = await res.json();
    } catch {
      throw Error(
        "The CRM service is unavailable. Start the server or check its configured address.",
      );
    }
    if (!res.ok) {
      if (res.status === 401 && path !== "/auth/login") {
        clearWorkspace();
        setSession(null);
      }
      throw Error(value.error || "Request failed.");
    }
    return value;
  }
  useEffect(() => {
    let active = true;
    request("/auth/me")
      .then((s) => {
        if (active) {
          clearWorkspace();
          setSession(s);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("meta");
    if (!result) return;
    params.delete("meta");
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (params.size ? `?${params}` : ""),
    );
    const messages = {
      connected:
        "Facebook connected. New Meta leads will now arrive automatically.",
      choose: "Facebook signed in. Choose the Page that runs your lead ads.",
      denied: "Facebook connection was cancelled.",
      expired: "That Facebook sign-in expired. Please connect again.",
      "no-pages":
        "No Facebook Pages were shared. Reconnect and allow access to your Page.",
      "missing-app":
        "The Meta app ID or secret is missing on the server. Add META_APP_ID and META_APP_SECRET.",
      error: "Facebook connection failed. See the details below.",
    };
    if (session.user.role === "admin") setView(result === "connected" ? "metaLeads" : "meta");
    if (result === "connected" || result === "choose") setNotice(messages[result]);
    else setError(messages[result] || "Facebook connection finished.");
  }, [session?.user.id]);
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") setRefresh((v) => v + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [session?.user.id]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const controller = new AbortController();
    const delay = setTimeout(
      async () => {
        try {
          const params = new URLSearchParams({
            ...filters,
            q: query,
            offset: String(offset),
          });
          const results = await Promise.all([
            request("/team", { signal: controller.signal }),
            request("/dashboard", { signal: controller.signal }),
            request(`/leads?${params}`, { signal: controller.signal }),
            request("/tasks", { signal: controller.signal }),
            view === "meta"
              ? request("/meta", { signal: controller.signal })
              : Promise.resolve(null),
          ]);
          if (!active) return;
          setUsers(results[0].users);
          setData(results[1]);
          setLeads(results[2].leads);
          setTotal(results[2].total);
          setTasks(results[3].tasks);
          if (results[4]) setMeta(results[4]);
          setLoaded(true);
        } catch (e) {
          if (active && e.name !== "AbortError") setError(e.message);
        }
      },
      query ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(delay);
      controller.abort();
    };
  }, [session?.user.id, view, query, filters, offset, refresh]);
  const reload = () => setRefresh((n) => n + 1);
  const navigate = (v) => {
    setView(v);
    setMenu(false);
    setError("");
    setNotice("");
    setQuery("");
    setOffset(0);
    setFilters({
      status: "",
      source: "",
      owner_id: "",
      priority: "",
      archived: "",
    });
  };
  const user = session?.user;
  const navigation = [
    ["overview", "Overview"],
    ["leads", "Lead inbox"],
    ["metaLeads", "Meta Ads Leads"],
    ["pipeline", "Sales pipeline"],
    ["tasks", "Follow-ups"],
    ["reports", "Reports"],
    ...(user?.role === "admin"
      ? [
          ["meta", "Meta setup"],
          ["team", "Team & access"],
        ]
      : []),
    ["settings", "Settings"],
  ];
  async function exportLeads() {
    setBusy(true);
    try {
      const params = new URLSearchParams({ ...filters, q: query });
      const res = await fetch(`${endpoint}/crm/export?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json();
        throw Error(d.error);
      }
      const blob = await res.blob(),
        href = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = href;
      a.download = "srivardhan-leads.csv";
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="crm crm-loading">
        <h1>Opening your workspace.</h1>
        <p>Checking your secure session…</p>
      </div>
    );
  if (!session)
    return (
      <div className="crm crm-login">
        <div className="crm-login-story">
          <a href={url()}>
            <img src={asset("logo.png")} alt="SRIVARDHAN logo" />
            <span>
              SRIVARDHAN<small>INFRA & INTERIORS</small>
            </span>
          </a>
          <div>
            <span className="crm-eyebrow">THE RELATIONSHIP STUDIO</span>
            <h1>
              Every great space
              <br />
              begins with a<br />
              <em>conversation.</em>
            </h1>
            <p>
              Your inquiries, your team, your next chapter.
              <br />
              Thoughtfully brought together.
            </p>
          </div>
          <small>PRIVATE TEAM WORKSPACE · VIJAYAWADA</small>
        </div>
        <div className="crm-login-form">
          <span className="crm-eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>Let’s move things forward.</h2>
          <p>Sign in to manage your client relationships.</p>
          <form
            className="crm-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const s = await request("/auth/login", {
                  method: "POST",
                  body: Object.fromEntries(new FormData(e.currentTarget)),
                });
                clearWorkspace();
                setSession(s);
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p className="crm-error" role="alert">
                {error}
              </p>
            )}
            <button className="crm-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to the CRM"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="crm-help">
            Need access? Contact your workspace administrator. First-time setup
            instructions are in the CRM guide.
          </p>
          <a href={url()} className="crm-text-button">
            ← Back to the website
          </a>
        </div>
      </div>
    );
  return (
    <div className="crm crm-shell">
      <aside
        ref={drawer}
        id="crm-navigation"
        className={`crm-sidebar ${menu ? "open" : ""}`}
      >
        <button
          className="crm-mobile-menu crm-icon-button crm-drawer-close"
          aria-label="Close workspace menu"
          onClick={() => setMenu(false)}
        >
          <Icon name="close" />
        </button>
        <a className="crm-brand" href={url()}>
          <img src={asset("logo.png")} alt="" />
          <span>
            SRIVARDHAN<small>RELATIONSHIP STUDIO</small>
          </span>
        </a>
        <div className="crm-workspace-label">
          YOUR WORKSPACE <span>01</span>
        </div>
        <nav aria-label="CRM navigation">
          {navigation.map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              aria-current={view === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <Icon name={key} />
              {label}
              {key === "tasks" && !!data?.overdue && (
                <span className="crm-nav-count">{data.overdue}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="crm-sidebar-note">
          <i />
          <span>
            Built for better
            <br />
            <b>client relationships.</b>
          </span>
        </div>
        <div className="crm-sidebar-user">
          <span className="crm-avatar">{initials(user.name)}</span>
          <div>
            <b>{user.name}</b>
            <small>{title(user.role)}</small>
          </div>
          <button
            className="crm-icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await request("/auth/logout", { method: "POST", body: {} });
                clearWorkspace();
                setSession(null);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="crm-menu-backdrop"
          aria-label="Close workspace menu"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="crm-workspace">
        <header className="crm-topbar">
          <div>
            <button
              className="crm-icon-button crm-mobile-menu"
              ref={menuButton}
              aria-expanded={menu}
              aria-controls="crm-navigation"
              aria-label="Open workspace menu"
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span className="crm-breadcrumb">/</span>
            <b>{navigation.find((n) => n[0] === view)?.[1]}</b>
          </div>
          <div>
            <span className="crm-date">
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className="crm-icon-button"
              onClick={reload}
              aria-label="Refresh workspace"
            >
              <Icon name="refresh" />
            </button>
            <span className="crm-avatar small">{initials(user.name)}</span>
          </div>
        </header>
        <main className="crm-main">
          <div className="crm-page-heading">
            <div>
              <span className="crm-eyebrow">
                SRIVARDHAN · CLIENT RELATIONSHIPS
              </span>
              <h1>
                {
                  {
                    overview: "A little clarity. A lot of possibility.",
                    leads: "Your next conversations.",
                    pipeline: "From possibility to project.",
                    tasks: "Keep the conversation going.",
                    reports: "A clearer view of your business.",
                    meta: "Connected to your next client.",
                    metaLeads: "Fresh from your ads.",
                    team: "Good work starts with a great team.",
                    settings: "Make this workspace yours.",
                  }[view]
                }
              </h1>
              <p>
                {
                  {
                    overview: `Welcome back, ${user.name.split(" ")[0]}. Here’s where things stand.`,
                    leads: "Every inquiry, thoughtfully organised.",
                    pipeline:
                      "Move opportunities forward, one meaningful step at a time.",
                    tasks:
                      "Calls, visits and decisions — all in their right place.",
                    reports:
                      "Real lead and project data, without the guesswork.",
                    meta: "Connect Facebook, manage Instant Forms and delivery health.",
                    metaLeads:
                      "Facebook and Instagram Instant Form leads, live as they arrive.",
                    team: "Clear responsibilities. The right access.",
                    settings: "Manage your account and workspace preferences.",
                  }[view]
                }
              </p>
            </div>
            {!["meta", "metaLeads", "team", "settings"].includes(view) && (
              <button className="crm-primary" onClick={() => setAdding(true)}>
                <Icon name="plus" /> New inquiry
              </button>
            )}
          </div>
          {error && (
            <div className="crm-error crm-alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <Icon name="close" />
              </button>
            </div>
          )}
          {notice && (
            <p className="crm-notice" role="status">
              {notice}
            </p>
          )}
          {view === "overview" && (
            <Overview
              data={data}
              onOpen={setSelected}
              setView={navigate}
              users={users}
            />
          )}
          {["leads", "pipeline"].includes(view) && (
            <>
              <div className="crm-filters">
                <label className="crm-search">
                  <Icon name="search" />
                  <input
                    aria-label="Search leads"
                    placeholder="Search name, phone, email or location"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOffset(0);
                    }}
                  />
                </label>
                {[
                  ["status", "All stages", STAGES],
                  ["source", "All sources", ["website", "meta", "manual"]],
                  ["priority", "All priorities", ["normal", "high", "urgent"]],
                ].map(([key, label, opts]) => (
                  <select
                    key={key}
                    aria-label={label}
                    value={filters[key]}
                    onChange={(e) => {
                      setFilters({ ...filters, [key]: e.target.value });
                      setOffset(0);
                    }}
                  >
                    <option value="">{label}</option>
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {title(o)}
                      </option>
                    ))}
                  </select>
                ))}
                {user.role !== "agent" && (
                  <select
                    aria-label="Filter lead owner"
                    value={filters.owner_id}
                    onChange={(e) => {
                      setFilters({ ...filters, owner_id: e.target.value });
                      setOffset(0);
                    }}
                  >
                    <option value="">All owners</option>
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="crm-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.archived === "1"}
                    onChange={(e) => {
                      setFilters({
                        ...filters,
                        archived: e.target.checked ? "1" : "",
                      });
                      setOffset(0);
                    }}
                  />{" "}
                  Archived
                </label>
                <button
                  className="crm-secondary"
                  disabled={busy || !total}
                  onClick={exportLeads}
                >
                  <Icon name="download" /> Export
                </button>
              </div>
              {view === "leads" ? (
                <section className="crm-panel">
                  {leads.length ? (
                    <LeadTable
                      leads={leads}
                      onOpen={setSelected}
                      users={users}
                    />
                  ) : (
                    <Empty
                      title={
                        loaded ? "No inquiries here yet." : "Loading inquiries…"
                      }
                    >
                      Try another filter or add a new inquiry to begin.
                    </Empty>
                  )}
                </section>
              ) : (
                <div className="crm-board">
                  {STAGES.map((stage) => {
                    const cards = leads.filter((l) => l.status === stage);
                    return (
                      <section className="crm-column" key={stage}>
                        <header>
                          <span>
                            <i className={stage} />
                            {title(stage)}
                          </span>
                          <b>{cards.length}</b>
                        </header>
                        <small>
                          {money(
                            cards.reduce((sum, l) => sum + l.deal_value, 0),
                          )}
                        </small>
                        {cards.map((l) => (
                          <button
                            className="crm-kanban-card"
                            key={l.id}
                            onClick={() => setSelected(l.id)}
                          >
                            <span>
                              <Badge>
                                {l.source === "meta"
                                  ? "Meta Ads"
                                  : title(l.source)}
                              </Badge>
                              {l.priority !== "normal" && (
                                <Badge tone="high">{l.priority}</Badge>
                              )}
                            </span>
                            <h3>{l.name}</h3>
                            <p>{l.service || "Scope to discuss"}</p>
                            <strong>
                              {l.deal_value
                                ? money(l.deal_value)
                                : "Value to discuss"}
                            </strong>
                            <footer>
                              <span>{l.location || "Location to discuss"}</span>
                              <span
                                className="crm-avatar small"
                                title={l.owner_name || "Unassigned"}
                              >
                                {l.owner_name ? initials(l.owner_name) : "—"}
                              </span>
                            </footer>
                          </button>
                        ))}
                        {!cards.length && (
                          <p className="crm-column-empty">
                            Room for the next opportunity.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              <div className="crm-pagination">
                <span>
                  {total
                    ? `${offset + 1}–${offset + leads.length} of ${total} inquiries`
                    : "0 inquiries"}
                  {view === "pipeline" && total > 100
                    ? " · Board shows this page only"
                    : ""}
                </span>
                <div>
                  <button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 100))}
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={offset + leads.length >= total}
                    onClick={() => setOffset(offset + 100)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
          {view === "tasks" && (
            <section className="crm-panel">
              <div className="crm-panel-heading">
                <div>
                  <h2>Scheduled follow-ups</h2>
                  <p>
                    All times are shown in your device’s timezone. Open a lead
                    to schedule a task.
                  </p>
                </div>
                <Badge>
                  {tasks.filter((t) => !t.completed_at).length} open
                </Badge>
              </div>
              <TaskList
                tasks={tasks}
                onEdit={async (taskId, input) => {
                  await request(`/tasks/${taskId}`, {
                    method: "PATCH",
                    body: input,
                  });
                  reload();
                }}
                onOpen={setSelected}
                onToggle={async (t) => {
                  try {
                    await request(`/tasks/${t.id}`, {
                      method: "PATCH",
                      body: { completed: !t.completed_at },
                    });
                    reload();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              />
            </section>
          )}
          {view === "reports" && data && (
            <>
              <div className="crm-metrics">
                {[
                  ["Open pipeline", money(data.pipelineValue)],
                  ["Won value", money(data.wonValue)],
                  [
                    "Win rate",
                    `${data.stages.filter((s) => ["won", "lost"].includes(s.status)).reduce((n, s) => n + s.count, 0) ? Math.round((data.stages.find((s) => s.status === "won").count / data.stages.filter((s) => ["won", "lost"].includes(s.status)).reduce((n, s) => n + s.count, 0)) * 100) : 0}%`,
                  ],
                  ["New in 7 days", data.newThisWeek],
                ].map(([label, val]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{val}</strong>
                    <small>From recorded CRM activity</small>
                  </article>
                ))}
              </div>
              <section className="crm-panel">
                <div className="crm-panel-heading">
                  <div>
                    <h2>Lead source performance</h2>
                    <p>
                      Win rate compares won and lost opportunities. No
                      advertising spend or ROI is inferred.
                    </p>
                  </div>
                </div>
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Inquiries</th>
                      <th>Won projects</th>
                      <th>Inquiry-to-win</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={s.source}>
                        <td>
                          {s.source === "meta"
                            ? "Meta Lead Ads"
                            : title(s.source)}
                        </td>
                        <td>{s.count}</td>
                        <td>{s.won}</td>
                        <td>
                          {s.count ? Math.round((s.won / s.count) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {view === "metaLeads" && (
            <MetaLeads
              request={request}
              user={user}
              users={users}
              onOpen={setSelected}
              refreshKey={refresh}
              endpoint={endpoint}
              onError={setError}
              setView={navigate}
            />
          )}
          {view === "meta" && (
            <MetaSettings
              endpoint={endpoint}
              data={meta}
              request={request}
              users={users}
              onRefresh={reload}
              onError={setError}
            />
          )}
          {view === "team" && (
            <Team
              users={users}
              request={request}
              onRefresh={reload}
              onError={setError}
            />
          )}
          {view === "settings" && (
            <section className="crm-panel crm-account">
              <h2>Account security</h2>
              <p>
                Signed in as {user.email}. Changing your password signs out all
                your sessions.
              </p>
              <form
                className="crm-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await request("/auth/password", {
                      method: "POST",
                      body: Object.fromEntries(new FormData(e.currentTarget)),
                    });
                    clearWorkspace();
                    setSession(null);
                    setError(
                      "Password changed. Sign in with your new password.",
                    );
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Current password
                  <input
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <button className="crm-primary" disabled={busy}>
                  Change password
                </button>
              </form>
            </section>
          )}
          <footer className="crm-workspace-footer">
            <span>SRIVARDHAN RELATIONSHIP STUDIO</span>
            <span>Private workspace · Auto-refreshes every 30 seconds</span>
          </footer>
        </main>
      </div>
      {adding && (
        <LeadForm
          users={users}
          manager={user.role !== "agent"}
          onClose={() => setAdding(false)}
          onSave={async (input) => {
            const r = await request("/leads", { method: "POST", body: input });
            setAdding(false);
            reload();
            setSelected(r.id);
          }}
        />
      )}
      {selected && (
        <LeadDetail
          id={selected}
          request={request}
          user={user}
          users={users}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
