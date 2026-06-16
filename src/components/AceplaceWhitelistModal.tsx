"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const initialForm = {
  company: "",
  useCase: "",
  deploymentInterest: "",
  infrastructureTier: "",
  providerInterest: [] as string[],
  classification: "",
};

const deploymentOptions = [
  "Sandbox Runtime",
  "Enterprise Runtime",
  "Telecom / AI-RAN",
  "Sovereign Infrastructure",
  "Research Access",
];

const tierOptions = [
  "Tier 0 Sandbox",
  "Tier 1 Hosted Runtime",
  "Tier 2 Enterprise Runtime",
  "Tier 3 Sovereign Runtime",
  "Tier 4 Telecom Infrastructure",
  "Tier 5 Air-Gapped Deployment",
];

const providerOptions = [
  "OpenAI",
  "Anthropic",
  "Gemini",
  "OpenRouter",
  "Local Models",
  "Sovereign AI",
  "Multi-Provider Runtime",
];

const classificationOptions = [
  "Telecom",
  "Enterprise",
  "Research",
  "Sovereign",
  "Government",
  "Infrastructure",
];

export default function AceplaceWhitelistModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const { user } = useAuth();

  type WhitelistReqData = {
    success: boolean;
    found: boolean;
    data: {
      _id: string;
      fullName: string;
      company: string;
      email: string;
      useCase: string;
      deploymentInterest: string;
      infrastructureTier: string;
      providerInterest: string[];
      classification: string;
      status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | string;
      source: string;
      runtimeIntent: {
        telecom: boolean;
        enterprise: boolean;
        sovereign: boolean;
        research: boolean;
      };
      review: {
        reviewed_by: string | null;
        reviewed_by_email: string | null;
        reviewed_at: string | null;
        decision: string | null;
        reason: string | null;
      };
      acelogicIdentity: {
        issued: boolean;
        issued_at: string | null;
        ace_id: string | null;
      };
      runtimeEnrollment: {
        enrolled: boolean;
        enrolled_at: string | null;
        assigned_tier: string | null;
        sandbox_provisioned: boolean;
      };
      createdAt: string;
      updatedAt: string;
    };
  };

  const [WhitelistReqData, setWhitelistReqData] =
    useState<WhitelistReqData | null>(null);

  console.log(WhitelistReqData);

  const status = WhitelistReqData?.data?.status;

  const isPending = status === "PENDING_REVIEW" || submitted;
  const isApproved = status === "APPROVED";
  const shouldShowStatusScreen = isPending || isApproved;

  useEffect(() => {
    if (!user?.email) return;

    const fetchWhitelistData = async () => {
      try {
        const res = await fetch(
          `/api/Aceplace_Whitelist_Access/User_Whitelist_Status?email=${encodeURIComponent(
            user.email || "",
          )}`,
        );

        const data = await res.json();

        setWhitelistReqData(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchWhitelistData();
  }, [user?.email]);

  const fullName = user?.displayName ?? "";
  const email = user?.email ?? "";

  const [form, setForm] = useState(initialForm);

  if (!open) return null;

  const resetForm = () => {
    setForm(initialForm);
    setError("");
    setSubmitted(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
    window.location.reload();
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleProvider = (value: string) => {
    setForm((prev) => {
      const exists = prev.providerInterest.includes(value);

      return {
        ...prev,
        providerInterest: exists
          ? prev.providerInterest.filter((item) => item !== value)
          : [...prev.providerInterest, value],
      };
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");

      const payload = {
        ...form,
        fullName,
        email,
      };

      const res = await fetch(
        "/api/Aceplace_Whitelist_Access/Request_Whitelist_Access",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Request failed");
      }

      setForm(initialForm);
      setError("");
      setSubmitted(true);
    } catch (err) {
      console.log(err);
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 px-2 py-3 backdrop-blur-md sm:px-4 sm:py-5">
      <div className="relative flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden border border-cyan-400/40 bg-[#020711]/95 shadow-[0_0_80px_rgba(6,182,212,0.25)]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,182,212,0.06)_1px,transparent_1px),linear-gradient(rgba(6,182,212,0.06)_1px,transparent_1px)] bg-[size:18px_18px] sm:bg-[size:22px_22px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-700/10" />

        <div className="relative shrink-0 border-b border-cyan-400/30 px-4 py-4 sm:px-7 sm:py-5">
          <p className="pr-14 text-[9px] font-black tracking-[0.22em] text-cyan-300 sm:text-xs sm:tracking-[0.32em]">
            LIMITED WHITELIST ACCESS
          </p>

          <h2 className="mt-2 pr-14 text-lg font-black uppercase tracking-[0.1em] text-white sm:text-2xl sm:tracking-[0.18em]">
            ACEPLACE™ Runtime Enrollment
          </h2>

          <p className="mt-2 max-w-3xl text-[10px] leading-5 tracking-[0.08em] text-slate-400 sm:mt-3 sm:text-xs sm:leading-6 sm:tracking-[0.14em]">
            Submit a governed runtime access request for identity-bound
            deterministic ACEAGENT infrastructure powered by ACELOGIC™
            continuity.
          </p>

          <button
            onClick={handleClose}
            className="absolute cursor-pointer right-4 top-4 border border-cyan-400/30 px-2.5 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-400/10 sm:right-5 sm:top-5 sm:px-3 sm:text-xs"
          >
            ESC
          </button>
        </div>

        <div className="modal-scrollbar-hide relative flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
          {shouldShowStatusScreen ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center sm:min-h-[360px]">
              <div className="mb-5 h-3 w-3 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_30px_rgba(52,211,153,1)] sm:mb-6 sm:h-4 sm:w-4" />

              <h3 className="text-lg font-black uppercase tracking-[0.14em] text-white sm:text-2xl sm:tracking-[0.2em]">
                {isApproved
                  ? "Whitelist Access Approved"
                  : "Whitelist Request Submitted"}
              </h3>

              <p
                className={`mt-3 text-xs font-bold uppercase tracking-[0.16em] ${isApproved ? "text-green-400" : "text-yellow-400"} sm:mt-4 sm:text-sm sm:tracking-[0.2em]`}
              >
                Status: {isApproved ? "Approved" : "Pending Review"}
              </p>

              <button
                onClick={handleClose}
                className="mt-7 cursor-pointer border border-cyan-400/50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 hover:bg-cyan-400/10 sm:mt-8 sm:px-8 sm:text-xs sm:tracking-[0.25em]"
              >
                Return To Workstation
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:gap-5 md:grid-cols-2">
                <Input label="Full Name" value={fullName} disabled />

                <Input
                  label="Company / Organization"
                  value={form.company}
                  onChange={(v) => updateField("company", v)}
                />

                <Input label="Email" value={email} disabled />

                <Select
                  label="Deployment Interest"
                  value={form.deploymentInterest}
                  options={deploymentOptions}
                  onChange={(v) => updateField("deploymentInterest", v)}
                />

                <Select
                  label="Infrastructure Tier"
                  value={form.infrastructureTier}
                  options={tierOptions}
                  onChange={(v) => updateField("infrastructureTier", v)}
                />

                <Select
                  label="Classification"
                  value={form.classification}
                  options={classificationOptions}
                  onChange={(v) => updateField("classification", v)}
                />
              </div>

              <div className="mt-4 sm:mt-5">
                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300 sm:text-[10px] sm:tracking-[0.25em]">
                  Intended Use Case
                </label>

                <textarea
                  value={form.useCase}
                  onChange={(e) => updateField("useCase", e.target.value)}
                  rows={3}
                  className="w-full border border-cyan-400/25 bg-black/50 px-3 py-2.5 text-xs text-cyan-50 outline-none placeholder:text-slate-600 focus:border-cyan-300 focus:shadow-[0_0_25px_rgba(6,182,212,0.2)] sm:px-4 sm:py-3 sm:text-sm"
                  placeholder="Describe your runtime deployment objective..."
                />
              </div>

              <div className="mt-4 sm:mt-5">
                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300 sm:mb-3 sm:text-[10px] sm:tracking-[0.25em]">
                  AI Provider Interest
                </label>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
                  {providerOptions.map((item) => {
                    const active = form.providerInterest.includes(item);

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleProvider(item)}
                        className={`border cursor-pointer px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.1em] transition-all sm:px-4 sm:py-3 sm:text-[11px] sm:tracking-[0.16em] ${
                          active
                            ? "border-cyan-300 bg-cyan-400/15 text-white shadow-[0_0_24px_rgba(6,182,212,0.28)]"
                            : "border-cyan-400/20 bg-black/40 text-slate-400 hover:border-cyan-400/50 hover:text-cyan-200"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="mt-4 border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-red-300 sm:mt-5 sm:px-4 sm:py-3 sm:text-xs sm:tracking-[0.14em]">
                  {error}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-4 border-t border-cyan-400/20 pt-4 sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
                <p className="text-[8px] font-bold uppercase leading-4 tracking-[0.14em] text-slate-500 sm:text-[10px] sm:tracking-[0.22em]">
                  Governed Execution · Deterministic Runtime · ACELOGIC™ Review
                </p>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="relative cursor-pointer inline-flex w-full items-center justify-center gap-2 overflow-hidden border border-cyan-300/70 bg-cyan-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_35px_rgba(6,182,212,0.35)] transition-all hover:bg-cyan-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-3 sm:px-7 sm:text-xs sm:tracking-[0.24em]"
                >
                  {loading && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-200/30 border-t-cyan-100 sm:h-4 sm:w-4" />
                  )}
                  {loading ? "Submitting..." : "Request Whitelist Access"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .modal-scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300 sm:mb-2 sm:text-[10px] sm:tracking-[0.25em]">
        {label}
      </label>

      <input
        value={value}
        disabled={disabled}
        readOnly={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full border border-cyan-400/25 bg-black/50 px-3 py-2.5 text-xs text-cyan-50 outline-none placeholder:text-slate-600 focus:border-cyan-300 focus:shadow-[0_0_25px_rgba(6,182,212,0.2)] disabled:cursor-not-allowed disabled:border-cyan-400/15 disabled:bg-black/30 disabled:text-slate-400 sm:px-4 sm:py-3 sm:text-sm"
        placeholder={label}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300 sm:mb-2 sm:text-[10px] sm:tracking-[0.25em]">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-cyan-400/25 bg-black/80 px-3 py-2.5 text-xs text-cyan-50 outline-none focus:border-cyan-300 focus:shadow-[0_0_25px_rgba(6,182,212,0.2)] sm:px-4 sm:py-3 sm:text-sm"
      >
        <option value="">Select {label}</option>
        {options.map((item) => (
          <option key={item} value={item} className="bg-black text-cyan-100">
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
