import React, { useState } from "react";
export default function Admin({ PageIntro, Arrow }) {
  const [token, setToken] = useState(""),
    [leads, setLeads] = useState([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0);
  const endpoint = import.meta.env.VITE_LEAD_API_URL || "/api";
  async function request(path = "", options = {}) {
    const r = await fetch(`${endpoint}/leads${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Request failed");
    return data;
  }
  async function load(e, nextOffset = offset) {
    e?.preventDefault();
    try {
      const data = await request(`?offset=${nextOffset}`);
      setLeads(data.leads);
      setOffset(data.offset);
      setTotal(data.total);
      setLoaded(true);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="AUTHORISED TEAM ACCESS"
        title="The lead desk."
        description="Review genuine inquiries and update their progress. Your access token is kept in memory for this session only."
      />
      <section className="admin section-pad">
        <form onSubmit={load}>
          <label>
            Staff access token
            <input
              value={token}
              type="password"
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <button className="button">
            {loaded ? "Refresh inquiries" : "Open lead desk"}
            <Arrow />
          </button>
        </form>
        {loaded && (
          <button
            onClick={() => {
              setToken("");
              setLeads([]);
              setLoaded(false);
            }}
          >
            Sign out
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        {loaded && leads.length === 0 && (
          <p>No inquiries have been received yet.</p>
        )}
        {loaded && (
          <div className="lead-pagination">
            <button
              disabled={offset === 0}
              onClick={() => load(null, Math.max(0, offset - 100))}
            >
              ← Newer
            </button>
            <span>
              {total
                ? `${offset + 1}–${offset + leads.length} of ${total}`
                : "0 inquiries"}
            </span>
            <button
              disabled={offset + leads.length >= total}
              onClick={() => load(null, offset + 100)}
            >
              Older →
            </button>
          </div>
        )}
        <div className="admin-leads">
          {leads.map((l) => (
            <article key={l.id}>
              <small>
                {new Date(l.created_at).toLocaleString()} · {l.id.slice(0, 8)}
              </small>
              <h3>{l.name}</h3>
              <a href={`tel:${l.phone}`}>{l.phone}</a>
              <p>
                {l.service} · {l.location}
              </p>
              <p>
                {l.property} · {l.area || "Area not specified"} · {l.budget} ·{" "}
                {l.timeline}
              </p>
              <p>{l.company}</p>
              <p>{l.message}</p>
              <label>
                Lead status
                <select
                  value={l.status}
                  onChange={async (e) => {
                    try {
                      await request(`/${l.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      await load();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  {[
                    "new",
                    "contacted",
                    "qualified",
                    "site visit",
                    "proposal",
                    "negotiation",
                    "won",
                    "lost",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <small>Notification: {l.notification_status}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
