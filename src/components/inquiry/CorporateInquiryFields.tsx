"use client";

import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  CORPORATE_ORG_TYPE_LABELS,
  CORPORATE_ORG_TYPES,
  getProgramsForOrgType,
  type CorporateOrgType,
} from "@/lib/corporate/corporateBrief";

export type CorporateFormState = {
  orgType: CorporateOrgType | "";
  orgName: string;
  purpose: string;
  programId: string;
  headcount: string;
  headcountFlexible: boolean;
  timing: string;
  timingFlexible: boolean;
  destination: string;
  budgetPerPerson: string;
  email: string;
  golfRounds: string;
  jobTopic: string;
  policyTopic: string;
  committeeFocus: string;
};

export const INITIAL_CORPORATE_FORM: CorporateFormState = {
  orgType: "",
  orgName: "",
  purpose: "",
  programId: "",
  headcount: "",
  headcountFlexible: false,
  timing: "",
  timingFlexible: false,
  destination: "",
  budgetPerPerson: "",
  email: "",
  golfRounds: "",
  jobTopic: "",
  policyTopic: "",
  committeeFocus: "",
};

export type CorporateFieldErrors = {
  orgType?: string;
  orgName?: string;
  purpose?: string;
};

type CorporateInquiryFieldsProps = {
  value: CorporateFormState;
  errors: CorporateFieldErrors;
  touched: { orgType?: boolean; orgName?: boolean; purpose?: boolean };
  onChange: (next: CorporateFormState) => void;
  onBlur: (field: keyof CorporateFieldErrors) => void;
};

export function CorporateInquiryFields({
  value,
  errors,
  touched,
  onChange,
  onBlur,
}: CorporateInquiryFieldsProps) {
  const programs = value.orgType ? getProgramsForOrgType(value.orgType) : [];
  const showGolfRounds = value.orgType === "business" && value.programId === "corporate-golf";

  return (
    <div className="md:col-span-2 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4">
      <h2 className="text-base font-semibold text-content-primary">기업·기관 정보</h2>

      <div className="flex flex-col gap-1">
        <Label className="flex flex-col gap-2">
          조직 유형 <span className="text-[var(--danger)]">*</span>
          <select
            name="orgType"
            value={value.orgType}
            onChange={(e) => {
              const orgType = e.target.value as CorporateOrgType | "";
              onChange({
                ...INITIAL_CORPORATE_FORM,
                orgType,
                orgName: value.orgName,
                purpose: value.purpose,
                destination: value.destination,
                budgetPerPerson: value.budgetPerPerson,
                email: value.email,
                headcount: value.headcount,
                headcountFlexible: value.headcountFlexible,
                timing: value.timing,
                timingFlexible: value.timingFlexible,
              });
            }}
            onBlur={() => onBlur("orgType")}
            className="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-content-primary"
            aria-invalid={touched.orgType && !!errors.orgType}
          >
            <option value="">선택해 주세요</option>
            {CORPORATE_ORG_TYPES.map((type) => (
              <option key={type} value={type}>
                {CORPORATE_ORG_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Label>
        {touched.orgType && errors.orgType ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {errors.orgType}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="flex flex-col gap-2">
            회사·기관명 <span className="text-[var(--danger)]">*</span>
            <Input
              name="orgName"
              value={value.orgName}
              onChange={(e) => onChange({ ...value, orgName: e.target.value })}
              onBlur={() => onBlur("orgName")}
              placeholder="예: ○○주식회사 / ○○공사"
              className="py-3"
              aria-invalid={touched.orgName && !!errors.orgName}
            />
          </Label>
          {touched.orgName && errors.orgName ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {errors.orgName}
            </p>
          ) : null}
        </div>

        <Label className="flex flex-col gap-2">
          프로그램 <span className="text-slate-400 type-small font-normal">(선택)</span>
          <select
            name="programId"
            value={value.programId}
            disabled={!value.orgType}
            onChange={(e) =>
              onChange({
                ...value,
                programId: e.target.value,
                golfRounds: e.target.value === "corporate-golf" ? value.golfRounds : "",
              })
            }
            className="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-content-primary disabled:opacity-60"
          >
            <option value="">선택 안 함</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </select>
        </Label>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="flex flex-col gap-2">
          행사 목적 <span className="text-[var(--danger)]">*</span>
          <Textarea
            name="purpose"
            rows={3}
            value={value.purpose}
            onChange={(e) => onChange({ ...value, purpose: e.target.value })}
            onBlur={() => onBlur("purpose")}
            placeholder="예: 성과 포상, 직무연수, 위원회 시찰"
            className="min-h-[4rem] py-3"
            aria-invalid={touched.purpose && !!errors.purpose}
          />
        </Label>
        {touched.purpose && errors.purpose ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {errors.purpose}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex flex-col gap-2">
            예상 인원 <span className="text-slate-400 type-small font-normal">(선택)</span>
            <Input
              name="headcount"
              value={value.headcount}
              disabled={value.headcountFlexible}
              onChange={(e) => onChange({ ...value, headcount: e.target.value })}
              placeholder="예: 20명"
              className="py-3"
            />
          </Label>
          <label className="inline-flex items-center gap-2 type-small text-content-secondary">
            <input
              type="checkbox"
              checked={value.headcountFlexible}
              onChange={(e) =>
                onChange({
                  ...value,
                  headcountFlexible: e.target.checked,
                  headcount: e.target.checked ? "" : value.headcount,
                })
              }
            />
            인원 미정
          </label>
        </div>

        <div className="space-y-2">
          <Label className="flex flex-col gap-2">
            희망 시기 <span className="text-slate-400 type-small font-normal">(선택)</span>
            <Input
              name="timing"
              value={value.timing}
              disabled={value.timingFlexible}
              onChange={(e) => onChange({ ...value, timing: e.target.value })}
              placeholder="예: 2026년 5월 / 상반기"
              className="py-3"
            />
          </Label>
          <label className="inline-flex items-center gap-2 type-small text-content-secondary">
            <input
              type="checkbox"
              checked={value.timingFlexible}
              onChange={(e) =>
                onChange({
                  ...value,
                  timingFlexible: e.target.checked,
                  timing: e.target.checked ? "" : value.timing,
                })
              }
            />
            시기 미정
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Label className="flex flex-col gap-2">
          목적지 <span className="text-slate-400 type-small font-normal">(선택)</span>
          <Input
            name="destination"
            value={value.destination}
            onChange={(e) => onChange({ ...value, destination: e.target.value })}
            placeholder="예: 일본 / 동남아"
            className="py-3"
          />
        </Label>
        <Label className="flex flex-col gap-2">
          1인 예산 <span className="text-slate-400 type-small font-normal">(선택)</span>
          <Input
            name="budgetPerPerson"
            value={value.budgetPerPerson}
            onChange={(e) => onChange({ ...value, budgetPerPerson: e.target.value })}
            placeholder="예: 150만원대"
            className="py-3"
          />
        </Label>
      </div>

      <Label className="flex flex-col gap-2">
        이메일 <span className="text-slate-400 type-small font-normal">(선택)</span>
        <Input
          type="email"
          name="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder="name@company.com"
          className="py-3"
        />
      </Label>

      {showGolfRounds ? (
        <Label className="flex flex-col gap-2">
          희망 라운드 수 <span className="text-slate-400 type-small font-normal">(선택)</span>
          <Input
            name="golfRounds"
            value={value.golfRounds}
            onChange={(e) => onChange({ ...value, golfRounds: e.target.value })}
            placeholder="예: 3라운드"
            className="py-3"
          />
        </Label>
      ) : null}

      {value.orgType === "public-enterprises" ? (
        <Label className="flex flex-col gap-2">
          직무 과제·관심 시설 <span className="text-slate-400 type-small font-normal">(선택)</span>
          <Textarea
            name="jobTopic"
            rows={2}
            value={value.jobTopic}
            onChange={(e) => onChange({ ...value, jobTopic: e.target.value })}
            placeholder="예: 에너지 시설 운영, 환경 시설 견학"
            className="min-h-[3.5rem] py-3"
          />
        </Label>
      ) : null}

      {value.orgType === "public-institutions" ? (
        <Label className="flex flex-col gap-2">
          정책 과제·면담 또는 답사 주제{" "}
          <span className="text-slate-400 type-small font-normal">(선택)</span>
          <Textarea
            name="policyTopic"
            rows={2}
            value={value.policyTopic}
            onChange={(e) => onChange({ ...value, policyTopic: e.target.value })}
            placeholder="예: 도시재생 정책 현장, 지역관광 사례"
            className="min-h-[3.5rem] py-3"
          />
        </Label>
      ) : null}

      {value.orgType === "councils" ? (
        <Label className="flex flex-col gap-2">
          위원회 또는 소관 분야·공식 방문 목적{" "}
          <span className="text-slate-400 type-small font-normal">(선택)</span>
          <Textarea
            name="committeeFocus"
            rows={2}
            value={value.committeeFocus}
            onChange={(e) => onChange({ ...value, committeeFocus: e.target.value })}
            placeholder="예: 교통위원회 / 도시정책 사례 시찰"
            className="min-h-[3.5rem] py-3"
          />
        </Label>
      ) : null}
    </div>
  );
}
