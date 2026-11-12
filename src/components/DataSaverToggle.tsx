"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function DataSaverToggle() {
  const t = useTranslations("dataSaver");
  const [on, setOn] = useState(false);
  useEffect(() => setOn(document.documentElement.classList.contains("data-saver")), []);
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-muted">
      <input
        type="checkbox"
        className="h-5 w-5 flex-none accent-[#4F6BFF]"
        checked={on}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          document.cookie = `hv_ds=${v ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
          document.documentElement.classList.toggle("data-saver", v);
        }}
      />
      <span>{t("label")} <span className="text-xs">({t("hint")})</span></span>
    </label>
  );
}
