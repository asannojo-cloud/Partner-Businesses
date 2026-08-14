import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  minLength?: number;
  className?: string;
}

/**
 * 눈 모양 아이콘으로 입력한 비밀번호를 평문으로 확인할 수 있는 입력창.
 * 붙여넣기/자동완성 등으로 실제 입력된 값이 의도와 다른지 눈으로 바로 확인할 수 있게 한다
 * (2026-08-14 사용자 요청 — 비밀번호가 맞는지 눈으로 확인하고 싶다는 문의에서 추가).
 */
export default function PasswordInput({ value, onChange, autoComplete, autoFocus, required, minLength, className }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm px-1"
      >
        {visible ? "🙈" : "👁"}
      </button>
    </div>
  );
}
