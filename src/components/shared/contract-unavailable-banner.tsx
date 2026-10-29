"use client";

import React, { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Code2, ServerOff } from "lucide-react";

export interface EndpointContractItem {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  endpoint: string;
  descriptionAr: string;
  status: "PENDING_BACKEND" | "PLANNED";
  samplePayload?: string;
  sampleRequest?: string;
  sampleResponse?: string;
}

interface ContractUnavailableBannerProps {
  title: string;
  moduleNameAr: string;
  contracts: EndpointContractItem[];
  alternativeActionDescription?: string;
}

export function ContractUnavailableBanner({
  title,
  moduleNameAr,
  contracts,
  alternativeActionDescription,
}: ContractUnavailableBannerProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
          <ServerOff className="w-6 h-6" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-stone-900 font-cairo">{title}</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              واجهة برمجية غير متوفرة بعد
            </span>
          </div>

          <p className="text-stone-600 text-sm mt-2 leading-relaxed">
            وحدة <strong className="text-stone-800">{moduleNameAr}</strong> جاهزة ومعرّفة هندسياً في الواجهة الأمامية عبر واجهات برمجية صارمة (TypeScript Interfaces)، ولكن نقاط النهاية الخاصة بها لم يتم إضافتها بعد في خادم Go Backend. التزاماً بقواعد المشروع الصارمة، تم حجب البيانات الوهمية (Mock Data) وتوثيق العقود المطلوبة أدناه لتسهيل ربطها فور اكتمالها في الخادم.
          </p>

          {alternativeActionDescription && (
            <div className="mt-3 p-3 bg-cream-50 border border-cream-300 rounded-xl text-xs text-stone-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{alternativeActionDescription}</span>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="inline-flex items-center gap-2 text-xs font-bold text-forest-700 hover:text-forest-900 bg-forest-50 hover:bg-forest-100/70 px-3 py-1.5 rounded-lg border border-forest-200 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showTechnicalDetails ? "إخفاء توثيق العقود الهندسية" : "عرض مواصفات وعقود الـ APIs المطلوبة من الخادم"}</span>
              {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showTechnicalDetails && (
            <div className="mt-4 pt-4 border-t border-stone-200 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                العقود ونقاط النهاية المطلوب إضافتها في Go API:
              </h4>

              <div className="space-y-3">
                {contracts.map((contract, idx) => (
                  <div key={idx} className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          contract.method === "GET"
                            ? "bg-blue-100 text-blue-700"
                            : contract.method === "POST"
                            ? "bg-emerald-100 text-emerald-700"
                            : contract.method === "PATCH" || contract.method === "PUT"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {contract.method}
                      </span>
                      <code className="font-mono text-stone-800 font-semibold">{contract.endpoint}</code>
                    </div>
                    <p className="text-stone-600 mt-1">{contract.descriptionAr}</p>

                    {contract.samplePayload && (
                      <div className="mt-2">
                        <span className="text-[10px] text-stone-500 font-semibold">نموذج الطلب (Request Payload):</span>
                        <pre className="mt-1 p-2 bg-stone-900 text-amber-300 rounded font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                          {contract.samplePayload}
                        </pre>
                      </div>
                    )}

                    {contract.sampleResponse && (
                      <div className="mt-2">
                        <span className="text-[10px] text-stone-500 font-semibold">نموذج الاستجابة المتوقع (Response):</span>
                        <pre className="mt-1 p-2 bg-stone-900 text-emerald-300 rounded font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                          {contract.sampleResponse}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
